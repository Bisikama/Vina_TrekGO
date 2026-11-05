import { createHash } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import {
  InventoryTaskStatus,
  PaymentStatus,
  Prisma,
  RentalFinancialStatus,
  RentalOrderExceptionStatus,
  RentalOrderStatus,
  ReservationStatus,
} from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { AppError } from 'src/shared/errors/app-error'
import { BOOKING_ERROR_CODES } from 'src/shared/errors/codes/booking.error-codes'
import { RENTAL_ORDERING_ERROR_CODES as RT } from 'src/shared/errors/codes/rental-ordering.error-codes'
import {
  cancelPendingRentalChargesWithTx,
  reserveRentalCancellationRefundWithTx,
} from '../../../payments/rental-cancellation-refund'
import { resolveActivePrimaryRentalLocation } from '../../../shared/primary-inventory-location'
import { releaseExtensionWithTx } from '../../extension/rental-extension.service'
import {
  SYSTEM_FAULT_CANCELLATION_REASON,
  type CancelRentalOrderSystemFaultCommand,
  type CancelRentalOrderSystemFaultResult,
  type RentalSystemFaultCancellationPort,
} from '../../application/ports/rental-system-fault-cancellation.port'
import {
  isWithDeliveryStaff,
  releaseWarehouseCustodyWithTx,
  warehouseReleaseOrderInclude,
} from '../rental-warehouse-release'

const SCOPE = 'RB-ADMIN:rental-order-system-fault-cancel'
const CANCELLABLE_STATUSES: RentalOrderStatus[] = [
  RentalOrderStatus.PAID,
  RentalOrderStatus.PREPARING,
  RentalOrderStatus.READY_FOR_HANDOVER,
]

const orderInclude = {
  ...warehouseReleaseOrderInclude,
  rentalHandoverViaOrderId: { select: { id: true } },
} satisfies Prisma.RentalOrderInclude

@Injectable()
export class PrismaRentalSystemFaultCancellationAdapter implements RentalSystemFaultCancellationPort {
  constructor(private readonly prisma: PrismaService) {}

  async cancel(command: CancelRentalOrderSystemFaultCommand): Promise<CancelRentalOrderSystemFaultResult> {
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          orderId: command.orderId,
          reasonCode: command.reasonCode,
          note: command.note,
          expectedVersion: command.expectedVersion,
        }),
      )
      .digest('hex')
    const idemWhere = {
      scope_userId_idempotencyKey: {
        scope: SCOPE,
        userId: command.actorUserId,
        idempotencyKey: command.idempotencyKey,
      },
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const cached = await tx.idempotencyRecord.findUnique({ where: idemWhere })
          if (cached) {
            if (cached.requestHash !== requestHash) throw AppError.fromCode(RT.IDEMPOTENCY_KEY_REUSED)
            if (cached.responseBody) return cached.responseBody as unknown as CancelRentalOrderSystemFaultResult
            throw AppError.fromCode(RT.OPERATION_CONFLICT)
          }
          await tx.idempotencyRecord.create({
            data: { scope: SCOPE, userId: command.actorUserId, idempotencyKey: command.idempotencyKey, requestHash },
          })

          // Cùng thứ tự khoá với luồng huỷ của khách: Trip → đơn.
          const pointer = await tx.rentalOrder.findUnique({ where: { id: command.orderId }, select: { tripId: true } })
          if (!pointer) throw AppError.fromCode(RT.RENTAL_ORDER_NOT_FOUND, { details: { orderId: command.orderId } })
          await tx.$queryRaw`SELECT id FROM trips WHERE id = ${pointer.tripId}::uuid FOR UPDATE`
          const trip = await tx.trip.findUnique({ where: { id: pointer.tripId }, select: { status: true } })
          // Trip đã huỷ: luồng lifecycle đang/sẽ huỷ và hoàn đơn theo chính sách huỷ Trip.
          if (trip?.status === 'CANCELLED' || trip?.status === 'INTERRUPTED')
            throw AppError.fromCode(BOOKING_ERROR_CODES.TRIP_CANCELLATION_PROCESSING)
          await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${command.orderId}::uuid FOR UPDATE`
          const order = await tx.rentalOrder.findUniqueOrThrow({
            where: { id: command.orderId },
            include: orderInclude,
          })

          if (order.version !== command.expectedVersion)
            throw AppError.fromCode(RT.VERSION_CONFLICT, {
              details: { expectedVersion: command.expectedVersion, currentVersion: order.version },
            })
          if (!CANCELLABLE_STATUSES.includes(order.status) || order.rentalHandoverViaOrderId)
            throw AppError.fromCode(RT.RENTAL_SYSTEM_FAULT_CANCELLATION_NOT_ALLOWED, {
              details: { orderId: order.id, status: order.status, handedOver: !!order.rentalHandoverViaOrderId },
            })
          if (isWithDeliveryStaff(order))
            throw AppError.fromCode(RT.CANCELLATION_REQUIRES_CUSTODY_RETURN, { details: { orderId: order.id } })
          if (order.financialStatus !== RentalFinancialStatus.PAID)
            throw AppError.fromCode(RT.PAYMENT_RECONCILIATION_REQUIRED, {
              details: { orderId: order.id, reason: 'ORDER_NOT_IN_PAID_STATE', financialStatus: order.financialStatus },
            })
          // Đơn đã gia hạn có nhiều hoá đơn: không hoàn gộp từ khoản thanh toán gốc (giống markNoShow).
          if (await tx.rentalExtensionRequest.count({ where: { orderId: order.id, status: 'APPLIED' } }))
            throw AppError.fromCode(RT.PAYMENT_RECONCILIATION_REQUIRED, {
              details: { orderId: order.id, reason: 'MULTI_PAYMENT_RENTAL_CANCELLATION_REVIEW_REQUIRED' },
            })

          const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
          const primaryLocationId = await resolveActivePrimaryRentalLocation(tx)

          // Hoàn 100% tiền thuê + cọc về nguồn thanh toán gốc (lỗi TrekGo, isUserFault = false).
          const feeRefund = Number(order.rentalFee.toFixed(0))
          const depositRefund = Number(order.totalDeposit.toFixed(0))
          const payment = await tx.payment.findFirst({
            where: {
              status: PaymentStatus.SUCCEEDED,
              invoice: { rentalOrderId: order.id, invoiceType: 'RENTAL' },
              application: { status: 'APPLIED' },
            },
            orderBy: { paidAt: 'asc' },
            select: { id: true },
          })
          if (!payment)
            throw AppError.fromCode(RT.PAYMENT_RECONCILIATION_REQUIRED, {
              details: { orderId: order.id, reason: 'RENTAL_PAYMENT_NOT_FOUND' },
            })
          const amount = order.rentalFee.plus(order.totalDeposit)
          let refund: Awaited<ReturnType<typeof reserveRentalCancellationRefundWithTx>>
          try {
            refund = await reserveRentalCancellationRefundWithTx(tx, {
              orderId: order.id,
              paymentId: payment.id,
              amount,
              reason: command.reasonCode,
              idempotencyKey: `rental-system-fault-cancel:${order.id}`,
              now,
            })
          } catch (failure) {
            if (
              failure instanceof Error &&
              /^(RENTAL_REFUND_|MULTI_PAYMENT_RENTAL_CANCELLATION_)/.test(failure.message)
            )
              throw AppError.fromCode(RT.PAYMENT_RECONCILIATION_REQUIRED, {
                details: { orderId: order.id, reason: failure.message },
              })
            throw failure
          }
          await tx.rentalOutboxEvent.upsert({
            where: { deduplicationKey: `refund-request:${refund.id}` },
            update: {},
            create: {
              deduplicationKey: `refund-request:${refund.id}`,
              eventType: 'RENTAL_REFUND_REQUESTED',
              aggregateType: 'RentalOrder',
              aggregateId: order.id,
              payload: {
                refundRef: refund.id,
                paymentRef: payment.id,
                rentalOrderId: order.id,
                component: 'SYSTEM_FAULT_CANCELLATION',
                amount: feeRefund + depositRefund,
                currency: order.currency,
                reason: command.reasonCode,
              },
            },
          })

          const pendingExtensions = await tx.rentalExtensionRequest.findMany({
            where: { orderId: order.id, status: 'PENDING_PAYMENT' },
            select: { id: true, orderId: true },
          })
          for (const pending of pendingExtensions) await releaseExtensionWithTx(tx, pending, 'CANCELLED', now)
          await cancelPendingRentalChargesWithTx(tx, order.id)
          await tx.rentalQuantityReservation.updateMany({
            where: {
              orderLine: { orderId: order.id },
              status: { in: [ReservationStatus.HELD, ReservationStatus.CONFIRMED] },
            },
            data: { status: ReservationStatus.RELEASED, releasedAt: now, version: { increment: 1 } },
          })
          await tx.rentalPickupCode.updateMany({
            where: { orderId: order.id, usedAt: null, revokedAt: null },
            data: { revokedAt: now },
          })

          const warehouse = await releaseWarehouseCustodyWithTx(tx, order, primaryLocationId, now, {
            closedTaskStatus: InventoryTaskStatus.CLOSED,
          })

          const updated = await tx.rentalOrder.update({
            where: { id: order.id },
            data: {
              status: RentalOrderStatus.CANCELLED,
              financialStatus: RentalFinancialStatus.REFUND_PENDING,
              // Thiếu hàng đã được giải quyết bằng việc huỷ; chỉ còn ACTION_REQUIRED nếu có unit chưa trả kho được.
              exceptionStatus:
                warehouse.unsafeUnits.length > 0
                  ? RentalOrderExceptionStatus.ACTION_REQUIRED
                  : RentalOrderExceptionStatus.NONE,
              cancelledAt: now,
              version: { increment: 1 },
            },
          })

          await tx.rentalOutboxEvent.upsert({
            where: { deduplicationKey: `system-fault-cancel:${order.id}` },
            update: {},
            create: {
              deduplicationKey: `system-fault-cancel:${order.id}`,
              eventType: 'RENTAL_ORDER_CANCELLED',
              aggregateType: 'RentalOrder',
              aggregateId: order.id,
              payload: {
                orderId: order.id,
                tripId: order.tripId,
                reason: SYSTEM_FAULT_CANCELLATION_REASON,
                reasonCode: command.reasonCode,
                status: RentalOrderStatus.CANCELLED,
                financialStatus: RentalFinancialStatus.REFUND_PENDING,
                refundRef: refund.id,
                refundAmount: feeRefund + depositRefund,
                custodyPendingReturn: false,
              },
            },
          })
          if (warehouse.unsafeUnits.length > 0) {
            await tx.rentalOutboxEvent.upsert({
              where: { deduplicationKey: `rental-action-required:unsafe-units:system-fault:${order.id}` },
              update: {},
              create: {
                deduplicationKey: `rental-action-required:unsafe-units:system-fault:${order.id}`,
                eventType: 'RENTAL_ACTION_REQUIRED',
                aggregateType: 'RentalOrder',
                aggregateId: order.id,
                payload: {
                  orderId: order.id,
                  tripId: order.tripId,
                  reason: 'UNSAFE_CUSTODY_UNIT_ON_CANCELLATION',
                  unsafeUnits: warehouse.unsafeUnits,
                  status: RentalOrderStatus.CANCELLED,
                },
              },
            })
          }

          await tx.auditLog.create({
            data: {
              userId: command.actorUserId,
              action: 'RENTAL_ORDER_SYSTEM_FAULT_CANCELLED',
              entityType: 'RentalOrder',
              entityId: order.id,
              oldValues: { status: order.status, financialStatus: order.financialStatus, version: order.version },
              newValues: {
                status: updated.status,
                financialStatus: updated.financialStatus,
                version: updated.version,
                reasonCode: command.reasonCode,
                note: command.note,
                refundRef: refund.id,
              },
              requestId: command.idempotencyKey,
            },
          })

          const response: CancelRentalOrderSystemFaultResult = {
            order: {
              id: updated.id,
              status: updated.status,
              financialStatus: updated.financialStatus,
              exceptionStatus: updated.exceptionStatus,
              cancelledAt: now.toISOString(),
              version: updated.version,
            },
            refund: {
              refundRef: refund.id,
              amount: feeRefund + depositRefund,
              feeRefund,
              depositRefund,
              status: refund.status,
            },
            releasedUnitIds: warehouse.releasedUnitIds,
            unsafeUnits: warehouse.unsafeUnits,
          }
          await tx.idempotencyRecord.update({
            where: idemWhere,
            data: {
              responseStatus: 200,
              responseBody: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue,
              completedAt: now,
            },
          })
          return response
        },
        { maxWait: 10_000, timeout: 30_000 },
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw AppError.fromCode(RT.OPERATION_CONFLICT)
      throw error
    }
  }
}
