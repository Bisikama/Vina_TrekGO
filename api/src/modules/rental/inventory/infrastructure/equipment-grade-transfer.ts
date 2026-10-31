import { createHash } from 'node:crypto'
import {
  EquipmentCondition,
  EquipmentUnitStatus,
  EventStatus,
  Prisma,
  RentalGrade,
  RentalOrderExceptionStatus,
  RentalOrderStatus,
  RentalUnitAssignmentStatus,
  ReservationStatus,
} from '@prisma/client'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_ERROR_CODES } from 'src/shared/errors/codes/rental.error-codes'
import {
  effectiveReservedQuantity,
  findShortageWindows,
  type GradeDecisionInput,
  type GradedProductRef,
} from '../application/services/equipment-grade.rules'

import { GRADE_DOWNGRADE_SHORTAGE_REASON } from '../../../../shared/constants/rental-event-reasons.constant'
export { GRADE_DOWNGRADE_SHORTAGE_REASON }

/** Đơn chưa bàn giao: còn có thể xử lý thiếu hàng bằng cách tìm món khác hoặc huỷ system-fault. */
const PRE_HANDOVER_STATUSES: RentalOrderStatus[] = [
  RentalOrderStatus.PENDING_PAYMENT,
  RentalOrderStatus.PAID,
  RentalOrderStatus.PREPARING,
  RentalOrderStatus.READY_FOR_HANDOVER,
]

export interface ApplyGradeDecisionParams {
  unitId: string
  product: GradedProductRef
  decision: GradeDecisionInput
  actorId: string
  now: Date
  /** Có khi quyết định đi kèm lần trả đồ (markUnitReady). */
  assignmentId?: string
}

export interface ApplyGradeDecisionResult {
  reviewId: string
  decision: 'KEEP' | 'DOWNGRADE'
  fromProductId: string
  toProductId: string | null
  unitVersion: number | null
  shortage: { orderIds: string[]; alertKeys: string[] }
}

/**
 * Ghi quyết định hạng cho một unit. DOWNGRADE: chuyển unit sang sản phẩm GOOD_USED cùng nhóm rồi
 * kiểm thiếu hàng cho sản phẩm cũ. Caller phải đang khoá unit; hàm này khoá cả nhóm sản phẩm theo id.
 * Đơn bị thiếu không bị đổi tiền/dòng/reservation — chỉ báo ACTION_REQUIRED cho nhân viên.
 */
export async function applyGradeDecision(
  tx: Prisma.TransactionClient,
  params: ApplyGradeDecisionParams,
): Promise<ApplyGradeDecisionResult> {
  const { product, decision } = params
  const evidenceIds = decision.evidenceIds && decision.evidenceIds.length > 0 ? decision.evidenceIds : undefined

  if (decision.decision === 'KEEP') {
    const review = await tx.equipmentGradeReview.create({
      data: {
        unitId: params.unitId,
        assignmentId: params.assignmentId ?? null,
        decision: 'KEEP',
        fromProductId: product.id,
        fromGrade: product.grade as RentalGrade,
        reason: decision.reason ?? null,
        note: decision.note ?? null,
        evidenceIds: evidenceIds ?? Prisma.DbNull,
        actorId: params.actorId,
      },
    })
    return {
      reviewId: review.id,
      decision: 'KEEP',
      fromProductId: product.id,
      toProductId: null,
      unitVersion: null,
      shortage: { orderIds: [], alertKeys: [] },
    }
  }

  // Khoá cả nhóm theo id — cùng thứ tự với catalog (lockGroup) và createOrder (sort productId).
  await tx.$queryRaw`SELECT id FROM rental_products WHERE grade_group_id = ${product.gradeGroupId}::uuid ORDER BY id FOR UPDATE`
  const target = await tx.rentalProduct.findFirst({
    where: { gradeGroupId: product.gradeGroupId, grade: RentalGrade.GOOD_USED },
    select: { id: true },
  })
  if (!target) {
    throw AppError.fromCode(RENTAL_ERROR_CODES.RENTAL_GRADE_TARGET_NOT_FOUND, {
      details: { productId: product.id, gradeGroupId: product.gradeGroupId },
    })
  }

  const unit = await tx.equipmentUnit.update({
    where: { id: params.unitId },
    data: { productId: target.id, version: { increment: 1 } },
    select: { id: true, version: true },
  })
  const review = await tx.equipmentGradeReview.create({
    data: {
      unitId: params.unitId,
      assignmentId: params.assignmentId ?? null,
      decision: 'DOWNGRADE',
      fromProductId: product.id,
      toProductId: target.id,
      fromGrade: RentalGrade.LIKE_NEW,
      toGrade: RentalGrade.GOOD_USED,
      reason: decision.reason ?? null,
      note: decision.note ?? null,
      evidenceIds: evidenceIds ?? Prisma.DbNull,
      actorId: params.actorId,
    },
  })

  const shortage = await flagDowngradeShortage(tx, {
    productId: product.id,
    reviewId: review.id,
    unitId: params.unitId,
    now: params.now,
  })

  return {
    reviewId: review.id,
    decision: 'DOWNGRADE',
    fromProductId: product.id,
    toProductId: target.id,
    unitVersion: unit.version,
    shortage,
  }
}

async function flagDowngradeShortage(
  tx: Prisma.TransactionClient,
  input: { productId: string; reviewId: string; unitId: string; now: Date },
): Promise<{ orderIds: string[]; alertKeys: string[] }> {
  const [supply, rows] = await Promise.all([
    tx.equipmentUnit.count({
      where: {
        productId: input.productId,
        status: {
          notIn: [
            EquipmentUnitStatus.MAINTENANCE,
            EquipmentUnitStatus.DAMAGED,
            EquipmentUnitStatus.LOST,
            EquipmentUnitStatus.RETIRED,
          ],
        },
        condition: { notIn: [EquipmentCondition.DAMAGED, EquipmentCondition.LOST] },
      },
    }),
    tx.rentalQuantityReservation.findMany({
      where: {
        productId: input.productId,
        occupiedUntil: { gt: input.now },
        OR: [
          { status: ReservationStatus.CONFIRMED },
          { status: ReservationStatus.HELD, holdExpiresAt: { gt: input.now } },
        ],
      },
      select: {
        id: true,
        quantity: true,
        occupiedFrom: true,
        occupiedUntil: true,
        orderLine: {
          select: {
            order: { select: { id: true, status: true, tripId: true } },
            rentalUnitAssignmentsViaOrderLineId: {
              where: { status: { in: [RentalUnitAssignmentStatus.HANDED_OVER, RentalUnitAssignmentStatus.RETURNED] } },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    }),
  ])

  const orders = new Map(rows.map((r) => [r.orderLine.order.id, r.orderLine.order]))
  const reservations = rows
    .map((r) => ({
      id: r.id,
      orderId: r.orderLine.order.id,
      quantity: effectiveReservedQuantity(
        PRE_HANDOVER_STATUSES.includes(r.orderLine.order.status),
        r.quantity,
        r.orderLine.rentalUnitAssignmentsViaOrderLineId.length,
      ),
      occupiedFrom: r.occupiedFrom,
      occupiedUntil: r.occupiedUntil,
    }))
    .filter((r) => r.quantity > 0)
  const windows = findShortageWindows(supply, reservations, input.now)
  if (windows.length === 0) return { orderIds: [], alertKeys: [] }

  const alertKeys: string[] = []
  for (const w of windows) {
    // Cùng cách tạo khoá với availability adapter để không sinh alert trùng cho một khoảng.
    const alertKey = createHash('sha256')
      .update(
        [
          'all',
          input.productId,
          w.reservation.occupiedFrom.toISOString(),
          w.reservation.occupiedUntil.toISOString(),
        ].join(':'),
      )
      .digest('hex')
    const availableCount = Math.max(0, supply - (w.peakReserved - w.reservation.quantity))
    await tx.rentalCapacityAlert.upsert({
      where: { alertKey },
      update: {
        requestedQuantity: w.reservation.quantity,
        availableCount,
        unknownUnitCount: 0,
        reason: GRADE_DOWNGRADE_SHORTAGE_REASON,
        status: 'ACTION_REQUIRED',
      },
      create: {
        alertKey,
        productId: input.productId,
        occupiedFrom: w.reservation.occupiedFrom,
        occupiedUntil: w.reservation.occupiedUntil,
        requestedQuantity: w.reservation.quantity,
        availableCount,
        unknownUnitCount: 0,
        reason: GRADE_DOWNGRADE_SHORTAGE_REASON,
        status: 'ACTION_REQUIRED',
      },
    })
    if (!alertKeys.includes(alertKey)) alertKeys.push(alertKey)
  }

  // Chỉ đơn chưa bàn giao mới cần xử lý; đơn đã giao đang giữ món của mình.
  const affected = [...new Set(windows.map((w) => w.reservation.orderId))]
    .map((id) => orders.get(id)!)
    .filter((o) => PRE_HANDOVER_STATUSES.includes(o.status))
    .sort((a, b) => a.id.localeCompare(b.id))

  const flaggedOrderIds: string[] = []
  for (const order of affected) {
    const updated = await tx.rentalOrder.updateMany({
      // Kiểm lại trạng thái: đơn có thể vừa bàn giao/huỷ sau lúc đọc reservation (đơn không bị khoá ở đây).
      where: {
        id: order.id,
        status: { in: PRE_HANDOVER_STATUSES },
      },
      data: { exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED, version: { increment: 1 } },
    })
    if (updated.count === 0) continue
    flaggedOrderIds.push(order.id)
    const deduplicationKey = `grade-downgrade-shortage:${order.id}:${input.reviewId}`
    await tx.rentalOutboxEvent.upsert({
      where: { deduplicationKey },
      update: {},
      create: {
        deduplicationKey,
        eventType: 'RENTAL_ACTION_REQUIRED',
        aggregateType: 'RentalOrder',
        aggregateId: order.id,
        status: EventStatus.PENDING,
        payload: {
          orderId: order.id,
          tripId: order.tripId,
          reason: GRADE_DOWNGRADE_SHORTAGE_REASON,
          productId: input.productId,
          unitId: input.unitId,
          gradeReviewId: input.reviewId,
          status: order.status,
        },
      },
    })
  }

  return { orderIds: flaggedOrderIds, alertKeys }
}
