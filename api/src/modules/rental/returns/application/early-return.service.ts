import { Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import {
  DeliveryTaskStatus,
  DeliveryTaskType,
  Prisma,
  RentalOrderStatus,
  RentalUnitAssignmentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { AppError } from 'src/shared/errors/app-error'
import { RENTAL_RETURN_ERROR_CODES as RR } from 'src/shared/errors/codes/rental-return.error-codes'
import { effectiveDueAt } from '../../ordering/extension/rental-extension.policy'
import { ensureReturnTaskWithTx, returnTaskScheduleAt } from '../../lifecycle/application/services/rental-return-task'
import { validateRentalOrderPaymentMembershipWithTx } from '../../payments/rental-membership.guard'
import { EARLY_RETURN_MIN_LEAD_MINUTES } from './early-return-scan.policy'
import { emitEarlyReturnEventTx } from './early-return-events'

type Tx = Prisma.TransactionClient

export const EARLY_RETURN_ADMIN_LIST_STATUSES = ['PENDING', 'CONFIRMED'] as const
export type EarlyReturnAdminListStatus = (typeof EARLY_RETURN_ADMIN_LIST_STATUSES)[number]

/** Customer-initiated scheduling does not change contractual due date or custody. */
@Injectable()
export class EarlyReturnService {
  constructor(private readonly prisma: PrismaService) {}

  async get(orderId: string, userId: string) {
    const order = await this.prisma.rentalOrder.findUnique({ where: { id: orderId }, select: { userId: true } })
    if (!order || order.userId !== userId) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
    return this.prisma.rentalEarlyReturnRequest.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } })
  }

  /** Danh sách cho Admin: đủ thông tin để quyết định mà không phải mở từng đơn. */
  async listForAdmin(status: EarlyReturnAdminListStatus = 'PENDING') {
    const rows = await this.prisma.rentalEarlyReturnRequest.findMany({
      where: { status },
      orderBy: status === 'PENDING' ? { requestedAt: 'asc' } : { confirmedSlotAt: 'asc' },
      take: 100,
      include: {
        requester: { select: { fullName: true, phone: true } },
        task: { select: { id: true, status: true, scheduledAt: true, staff: { select: { fullName: true } } } },
        order: {
          select: {
            status: true,
            rentalEndAt: true,
            operationalReturnDueAt: true,
            returnPoint: { select: { name: true, address: true } },
            rentalOrderLinesViaOrderId: {
              select: {
                _count: {
                  select: {
                    rentalUnitAssignmentsViaOrderLineId: {
                      where: { status: RentalUnitAssignmentStatus.HANDED_OVER, returnedAt: null },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    return rows.map(
      ({ order: { rentalOrderLinesViaOrderId, rentalEndAt, operationalReturnDueAt, ...order }, ...row }) => ({
        ...row,
        order: {
          ...order,
          effectiveDueAt: effectiveDueAt(rentalEndAt, operationalReturnDueAt),
          outstandingUnits: rentalOrderLinesViaOrderId.reduce(
            (sum, line) => sum + line._count.rentalUnitAssignmentsViaOrderLineId,
            0,
          ),
        },
      }),
    )
  }

  async request(orderId: string, userId: string, requestedSlotAt: Date, key: string, now?: Date) {
    return this.mutate(
      'EARLY_RETURN_REQUEST',
      userId,
      key,
      { orderId, requestedSlotAt: requestedSlotAt.toISOString() },
      now,
      async (tx, at) => {
        await lockOrder(tx, orderId)
        const order = await tx.rentalOrder.findUnique({
          where: { id: orderId },
          include: {
            packageViaOrderId: true,
            rentalHandoverViaOrderId: true,
            rentalReturnSessionsViaOrderId: { take: 1 },
            rentalOrderLinesViaOrderId: { include: { rentalUnitAssignmentsViaOrderLineId: true } },
          },
        })
        if (!order || order.userId !== userId) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
        if (!(await validateRentalOrderPaymentMembershipWithTx(tx, order))) throw AppError.fromCode(RR.FORBIDDEN, { message: 'Bạn không còn là thành viên hợp lệ của chuyến đi nên không thể yêu cầu trả sớm.' })
        const assignments = order.rentalOrderLinesViaOrderId.flatMap((line) => line.rentalUnitAssignmentsViaOrderLineId)
        if (
          order.status !== RentalOrderStatus.ACTIVE ||
          !order.packageViaOrderId ||
          !order.rentalHandoverViaOrderId ||
          order.rentalReturnSessionsViaOrderId.length ||
          !assignments.some((a) => a.status === RentalUnitAssignmentStatus.HANDED_OVER) ||
          assignments.some((a) => a.status === RentalUnitAssignmentStatus.RETURNED || a.returnedAt)
        )
          throw AppError.fromCode(RR.RETURN_NOT_READY, {
            message: 'Chỉ đơn đang thuê, đã nhận thiết bị và chưa bắt đầu trả mới yêu cầu trả sớm được.',
          })
        const due = effectiveDueAt(order.rentalEndAt, order.operationalReturnDueAt)
        if (
          requestedSlotAt.getTime() <= at.getTime() + EARLY_RETURN_MIN_LEAD_MINUTES * 60_000 ||
          requestedSlotAt >= due
        )
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            message: EARLY_RETURN_MIN_LEAD_MINUTES
              ? `Lịch đề xuất phải cách hiện tại ít nhất ${EARLY_RETURN_MIN_LEAD_MINUTES} phút và trước hạn trả.`
              : 'Lịch đề xuất phải ở tương lai và trước hạn trả.',
            details: { minLeadMinutes: EARLY_RETURN_MIN_LEAD_MINUTES, effectiveDueAt: due.toISOString() },
          })
        if (await tx.rentalExtensionRequest.findFirst({ where: { orderId, status: 'PENDING_PAYMENT' } }))
          throw AppError.fromCode(RR.OPERATION_CONFLICT, { message: 'Đơn đang có yêu cầu gia hạn chờ thanh toán.' })
        if (
          await tx.rentalEarlyReturnRequest.findFirst({ where: { orderId, status: { in: ['PENDING', 'CONFIRMED'] } } })
        )
          throw AppError.fromCode(RR.OPERATION_CONFLICT, { message: 'Đơn đã có yêu cầu trả sớm.' })
        const task = await tx.deliveryTask.findUnique({
          where: { orderId_taskType: { orderId, taskType: DeliveryTaskType.RETURN } },
        })
        if (task && task.status !== DeliveryTaskStatus.SCHEDULED)
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            message: 'Đơn đang trong quá trình thu hồi.',
            details: { taskStatus: task.status },
          })
        // Cùng điều kiện với confirm(): lịch có sẵn sớm hơn thì yêu cầu không bao giờ được xác nhận.
        if (task?.scheduledAt && task.scheduledAt < requestedSlotAt)
          throw AppError.fromCode(RR.OPERATION_CONFLICT, {
            message: 'Đơn đã có lịch thu hồi sớm hơn giờ bạn chọn.',
            details: { scheduledAt: task.scheduledAt.toISOString() },
          })
        const request = await tx.rentalEarlyReturnRequest.create({
          data: { orderId, userId, status: 'PENDING', requestedAt: at, requestedSlotAt },
        })
        await audit(
          tx,
          userId,
          'RENTAL_EARLY_RETURN_REQUESTED',
          request.id,
          { orderId, requestedSlotAt: requestedSlotAt.toISOString() },
          key,
        )
        await emitEarlyReturnEventTx(tx, {
          requestId: request.id,
          orderId,
          status: 'REQUESTED',
          version: request.version,
          slotAt: requestedSlotAt,
        })
        return request
      },
    )
  }

  async confirm(requestId: string, adminId: string, expectedVersion: number, key: string, now?: Date) {
    return this.mutate('EARLY_RETURN_CONFIRM', adminId, key, { requestId, expectedVersion }, now, async (tx, at) => {
      await requireActiveAdmin(tx, adminId)
      const request = await lockRequest(tx, requestId)
      if (request.status !== 'PENDING')
        throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
          message: 'Chỉ xác nhận được yêu cầu đang chờ xác nhận.',
          details: { status: request.status },
        })
      if (request.order.status !== RentalOrderStatus.ACTIVE)
        throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
          message: 'Đơn thuê không còn ở trạng thái đang thuê.',
          details: { orderStatus: request.order.status },
        })
      if (request.version !== expectedVersion) throw AppError.fromCode(RR.VERSION_CONFLICT, { message: 'Yêu cầu trả sớm vừa thay đổi, hãy tải lại rồi thử lại.' })
      if (!(await validateRentalOrderPaymentMembershipWithTx(tx, request.order))) throw AppError.fromCode(RR.FORBIDDEN, { message: 'Khách không còn là thành viên hợp lệ của chuyến đi; hãy từ chối yêu cầu.' })
      if (await tx.rentalReturnSession.findFirst({ where: { orderId: request.orderId } }))
        throw AppError.fromCode(RR.INVALID_RETURN_STATE, { message: 'Đơn đã bắt đầu trả thiết bị.' })
      if (await tx.rentalExtensionRequest.findFirst({ where: { orderId: request.orderId, status: 'PENDING_PAYMENT' } }))
        throw AppError.fromCode(RR.OPERATION_CONFLICT, { message: 'Đơn đang có yêu cầu gia hạn chờ thanh toán.' })
      const outstanding = await tx.rentalUnitAssignment.count({
        where: {
          orderLine: { orderId: request.orderId },
          status: RentalUnitAssignmentStatus.HANDED_OVER,
          returnedAt: null,
        },
      })
      if (!outstanding) throw AppError.fromCode(RR.RETURN_NOT_READY, { message: 'Đơn không còn thiết bị cần thu hồi.' })
      if (
        request.requestedSlotAt <= at ||
        request.requestedSlotAt >= effectiveDueAt(request.order.rentalEndAt, request.order.operationalReturnDueAt)
      )
        throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
          message: 'Lịch đề xuất đã qua hoặc không còn trước hạn trả; hãy từ chối để khách đặt lịch khác.',
        })
      const existing = await tx.deliveryTask.findUnique({
        where: { orderId_taskType: { orderId: request.orderId, taskType: DeliveryTaskType.RETURN } },
      })
      if (existing && existing.status !== DeliveryTaskStatus.SCHEDULED)
        throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
          message: 'Nhân viên đã bắt đầu thu hồi đơn này.',
          details: { taskStatus: existing.status },
        })
      if (existing?.scheduledAt && existing.scheduledAt < request.requestedSlotAt)
        throw AppError.fromCode(RR.OPERATION_CONFLICT, {
          message: 'Đơn đã có lịch thu hồi sớm hơn; cần điều phối lịch hiện có.',
          details: { scheduledAt: existing.scheduledAt.toISOString() },
        })
      const taskId = await ensureReturnTaskWithTx(tx, request.orderId, request.requestedSlotAt, 'USER_EARLY_RETURN')
      if (!taskId) throw AppError.fromCode(RR.RETURN_NOT_READY)
      const result = await tx.rentalEarlyReturnRequest.update({
        where: { id: requestId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: at,
          confirmedBy: adminId,
          confirmedSlotAt: request.requestedSlotAt,
          taskId,
          previousTaskAt: existing?.scheduledAt ?? null,
          supersededAt: null,
          version: { increment: 1 },
        },
      })
      await audit(
        tx,
        adminId,
        'RENTAL_EARLY_RETURN_CONFIRMED',
        requestId,
        { orderId: request.orderId, taskId, slotAt: request.requestedSlotAt.toISOString() },
        key,
      )
      await emitEarlyReturnEventTx(tx, {
        requestId,
        orderId: request.orderId,
        status: 'CONFIRMED',
        version: result.version,
        slotAt: request.requestedSlotAt,
      })
      return result
    })
  }

  /** Admin từ chối yêu cầu chưa xác nhận. Task (nếu có) đã được dời Trip đưa về hạn nên không cần sửa. */
  async reject(requestId: string, adminId: string, expectedVersion: number, reason: string, key: string, now?: Date) {
    return this.mutate(
      'EARLY_RETURN_REJECT',
      adminId,
      key,
      { requestId, expectedVersion, reason },
      now,
      async (tx, at) => {
        await requireActiveAdmin(tx, adminId)
        const request = await lockRequest(tx, requestId)
        if (request.status !== 'PENDING')
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            message: 'Chỉ từ chối được yêu cầu đang chờ xác nhận.',
            details: { status: request.status },
          })
        if (request.version !== expectedVersion) throw AppError.fromCode(RR.VERSION_CONFLICT, { message: 'Yêu cầu trả sớm vừa thay đổi, hãy tải lại rồi thử lại.' })
        const result = await tx.rentalEarlyReturnRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            rejectedBy: adminId,
            rejectedAt: at,
            rejectionReason: reason,
            version: { increment: 1 },
          },
        })
        await audit(tx, adminId, 'RENTAL_EARLY_RETURN_REJECTED', requestId, { orderId: request.orderId, reason }, key)
        await emitEarlyReturnEventTx(tx, {
          requestId,
          orderId: request.orderId,
          status: 'REJECTED',
          version: result.version,
          slotAt: request.requestedSlotAt,
          reason,
        })
        return result
      },
    )
  }

  /**
   * Yêu cầu PENDING không thể xác nhận nữa (quá giờ hẹn, hoặc dời Trip làm hạn trả sớm hơn giờ hẹn)
   * chuyển EXPIRED để không chặn gia hạn và không treo trên màn khách/admin.
   */
  async expireStale(now?: Date, limit = 50): Promise<number> {
    // Chỉ lấy yêu cầu đã đủ điều kiện hết hạn: không khoá đơn của các yêu cầu còn hợp lệ mỗi phút,
    // và yêu cầu cần hết hạn không bị các yêu cầu còn hợp lệ đẩy ra khỏi lô.
    // Điều kiện hạn trả giống effectiveDueAt(); transaction bên dưới vẫn kiểm lại sau khi khoá.
    const candidates = await this.prisma.$queryRaw<{ id: string; orderId: string }[]>`
      SELECT r.id::text AS id, r.order_id::text AS "orderId"
      FROM rental_early_return_requests r
      JOIN rental_orders o ON o.id = r.order_id
      WHERE r.status = 'PENDING'
        AND (r.requested_slot_at <= COALESCE(${now ?? null}::timestamptz, clock_timestamp())
          OR r.requested_slot_at >= GREATEST(o.rental_end_at, COALESCE(o.operational_return_due_at, o.rental_end_at)))
      ORDER BY r.requested_slot_at ASC, r.id ASC
      LIMIT ${limit}`
    let expired = 0
    for (const candidate of candidates) {
      const changed = await this.prisma.$transaction(async (tx) => {
        await lockOrder(tx, candidate.orderId)
        const at = now ?? (await dbNow(tx))
        const request = await tx.rentalEarlyReturnRequest.findUnique({
          where: { id: candidate.id },
          include: { order: true },
        })
        if (!request || request.status !== 'PENDING') return false
        const due = effectiveDueAt(request.order.rentalEndAt, request.order.operationalReturnDueAt)
        if (request.requestedSlotAt > at && request.requestedSlotAt < due) return false
        const result = await tx.rentalEarlyReturnRequest.update({
          where: { id: request.id },
          data: { status: 'EXPIRED', expiredAt: at, version: { increment: 1 } },
        })
        await tx.auditLog.create({
          data: {
            action: 'RENTAL_EARLY_RETURN_EXPIRED',
            entityType: 'RentalEarlyReturnRequest',
            entityId: request.id,
            newValues: {
              orderId: request.orderId,
              requestedSlotAt: request.requestedSlotAt.toISOString(),
              effectiveDueAt: due.toISOString(),
            },
          },
        })
        await emitEarlyReturnEventTx(tx, {
          requestId: request.id,
          orderId: request.orderId,
          status: 'EXPIRED',
          version: result.version,
          slotAt: request.requestedSlotAt,
        })
        return true
      })
      if (changed) expired += 1
    }
    return expired
  }

  async cancel(requestId: string, userId: string, expectedVersion: number, key: string, now?: Date) {
    return this.mutate('EARLY_RETURN_CANCEL', userId, key, { requestId, expectedVersion }, now, async (tx, at) => {
      const request = await lockRequest(tx, requestId)
      if (request.userId !== userId) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
      if (!['PENDING', 'CONFIRMED'].includes(request.status))
        throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
          message: 'Yêu cầu này đã kết thúc, không thể huỷ.',
          details: { status: request.status },
        })
      if (request.order.status !== RentalOrderStatus.ACTIVE)
        throw AppError.fromCode(RR.INVALID_RETURN_STATE, { message: 'Đơn thuê không còn ở trạng thái đang thuê.' })
      if (request.version !== expectedVersion) throw AppError.fromCode(RR.VERSION_CONFLICT, { message: 'Yêu cầu trả sớm vừa thay đổi, hãy tải lại rồi thử lại.' })
      if (await tx.rentalReturnSession.findFirst({ where: { orderId: request.orderId } }))
        throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
          message: 'Nhân viên đã bắt đầu nhận thiết bị, không thể huỷ.',
        })
      if (request.taskId && !request.supersededAt) {
        const task = await tx.deliveryTask.findUnique({ where: { id: request.taskId } })
        if (!task || task.status !== DeliveryTaskStatus.SCHEDULED)
          throw AppError.fromCode(RR.INVALID_RETURN_STATE, {
            message: 'Nhân viên đã bắt đầu thu hồi, không thể huỷ.',
            details: { taskStatus: task?.status ?? null },
          })
        // Keep the assignee and task history; only undo the schedule written by this request.
        if (
          task.scheduledAt &&
          request.confirmedSlotAt &&
          task.scheduledAt.getTime() === request.confirmedSlotAt.getTime()
        ) {
          const due = effectiveDueAt(request.order.rentalEndAt, request.order.operationalReturnDueAt)
          await tx.deliveryTask.update({
            where: { id: task.id },
            data: {
              scheduledAt: request.previousTaskAt ?? returnTaskScheduleAt(request.order.returnOptionSnapshot, due),
              version: { increment: 1 },
            },
          })
        }
      }
      const result = await tx.rentalEarlyReturnRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      })
      await audit(
        tx,
        userId,
        'RENTAL_EARLY_RETURN_CANCELLED',
        requestId,
        { orderId: request.orderId, cancelledAt: at.toISOString() },
        key,
      )
      await emitEarlyReturnEventTx(tx, {
        requestId,
        orderId: request.orderId,
        status: 'CANCELLED',
        version: result.version,
        slotAt: request.confirmedSlotAt ?? request.requestedSlotAt,
        wasConfirmed: request.status === 'CONFIRMED',
      })
      return result
    })
  }

  private async mutate<T>(
    scope: string,
    userId: string,
    idempotencyKey: string,
    request: unknown,
    now: Date | undefined,
    work: (tx: Tx, at: Date) => Promise<T>,
  ): Promise<T> {
    const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex')
    try {
      return await this.prisma.$transaction(async (tx) => {
        const where = { scope_userId_idempotencyKey: { scope, userId, idempotencyKey } }
        const existing = await tx.idempotencyRecord.findUnique({ where })
        if (existing) {
          if (existing.requestHash !== requestHash) throw AppError.fromCode(RR.IDEMPOTENCY_KEY_REUSED)
          if (existing.responseBody) return existing.responseBody as T
          throw AppError.fromCode(RR.OPERATION_CONFLICT)
        }
        await tx.idempotencyRecord.create({ data: { scope, userId, idempotencyKey, requestHash } })
        const at = now ?? (await dbNow(tx))
        const result = await work(tx, at)
        const responseBody = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue
        await tx.idempotencyRecord.update({ where, data: { responseStatus: 200, responseBody, completedAt: at } })
        return result
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw AppError.fromCode(RR.OPERATION_CONFLICT)
      throw error
    }
  }
}

/** Giờ của DB, không phụ thuộc đồng hồ máy chạy app. */
async function dbNow(tx: Tx): Promise<Date> {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  return row.now
}

async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${orderId}::uuid FOR UPDATE`
}

/** Khoá đơn trước rồi mới đọc lại yêu cầu, cùng thứ tự khoá với gia hạn và quét trả. */
async function lockRequest(tx: Tx, requestId: string) {
  const initial = await tx.rentalEarlyReturnRequest.findUnique({ where: { id: requestId }, select: { orderId: true } })
  if (!initial) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
  await lockOrder(tx, initial.orderId)
  const request = await tx.rentalEarlyReturnRequest.findUnique({ where: { id: requestId }, include: { order: true } })
  if (!request) throw AppError.fromCode(RR.RENTAL_NOT_FOUND)
  return request
}

async function requireActiveAdmin(tx: Tx, adminId: string) {
  const admin = await tx.user.findFirst({
    where: { id: adminId, role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    select: { id: true },
  })
  if (!admin) throw AppError.fromCode(RR.FORBIDDEN)
}

async function audit(
  tx: Tx,
  userId: string,
  action: string,
  entityId: string,
  values: Prisma.InputJsonValue,
  requestId: string,
) {
  await tx.auditLog.create({
    data: {
      userId,
      action,
      entityType: 'RentalEarlyReturnRequest',
      entityId,
      newValues: values,
      requestId: requestId.slice(0, 120),
    },
  })
}
