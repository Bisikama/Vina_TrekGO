import { Prisma } from '@prisma/client'
import { HANDOVER_SHORTAGE_REASON } from '../../shared/constants/rental-event-reasons.constant'
import {
  HANDOVER_SHORTAGE_ASSIGNMENT_WHERE,
  HANDOVER_SHORTAGE_REFUND_CASE_PREFIX,
} from '../rental/shared/handover-shortage'

type SettledRefund = Prisma.RefundGetPayload<{ include: { payment: { include: { application: true } } } }>

/**
 * Refund of units missing at handover failed or needs review: one REFUND_FAILURE case per refund (a later
 * SUCCEEDED resolves it through the `[refund:<id>]` tag). The order stays as it is — it is still live.
 */
export async function openHandoverShortageRefundCase(
  tx: Prisma.TransactionClient,
  refund: { id: string; rentalOrderId: string | null; amount: Prisma.Decimal },
  status: string,
) {
  if (!refund.rentalOrderId) return
  const tag = `[refund:${refund.id}]`
  const existing = await tx.rentalExceptionCase.findFirst({
    where: { orderId: refund.rentalOrderId!, reason: { contains: tag } },
    select: { id: true },
  })
  if (existing) return
  // Attached to a missing unit's assignment so it does not block the deposit refunds of handed-over units.
  const missing = await tx.rentalUnitAssignment.findFirst({
    where: { orderLine: { orderId: refund.rentalOrderId! }, ...HANDOVER_SHORTAGE_ASSIGNMENT_WHERE },
    select: { id: true, equipmentUnitId: true },
  })
  await tx.rentalExceptionCase.create({
    data: {
      orderId: refund.rentalOrderId!,
      assignmentId: missing?.id ?? null,
      unitId: missing?.equipmentUnitId ?? null,
      caseType: 'REFUND_FAILURE',
      reason: `${tag} ${HANDOVER_SHORTAGE_REFUND_CASE_PREFIX} refund ${status}; hoàn tay ${refund.amount.toFixed(0)} VND`,
      evidenceIds: [],
    },
  })
}
/** Caller owns invoice/payment/refund locks and has already validated its evidence source. */
export async function publishRefundSettlement(
  tx: Prisma.TransactionClient,
  refund: SettledRefund,
  event: { status: string; refundTransactionRef: string | null },
  confirmationSource: 'PROVIDER' | 'ADMIN_MANUAL' | 'SANDBOX_SIMULATION' = 'PROVIDER',
) {
  if (event.status === 'SUCCEEDED' || event.status === 'FAILED') {
    await tx.paymentOutboxEvent.create({
      data: {
        deduplicationKey: `refund:${refund.id}:${event.status.toLowerCase()}:v1`,
        eventType: `REFUND_${event.status}`,
        aggregateType: 'Refund',
        aggregateId: refund.id,
        payload: {
          schemaVersion: 1,
          confirmationSource,
          refundId: refund.id,
          paymentId: refund.paymentId,
          businessActionId: refund.businessActionId,
          purpose: refund.purpose,
          source: {
            bookingCancellationId: refund.bookingCancellationId,
            depositSettlementId: refund.depositSettlementId,
            depositSettlementItemId: refund.depositSettlementItemId,
          },
          amount: refund.amount.toFixed(),
          currency: refund.currency,
          providerRef: event.refundTransactionRef,
        },
      },
    })
  }
  // Invoice ghi nhận tiền đã thu; chỉ đổi sang đã hoàn khi cổng xác nhận refund.
  // Hoàn kỹ thuật của payment bị từ chối áp dụng cũng phải kết thúc trạng thái PAID.
  if (
    event.status === 'SUCCEEDED' &&
    (refund.payment.application?.status === 'APPLIED' ||
      (refund.purpose === 'TECHNICAL_REVERSAL' && refund.payment.application?.status === 'REJECTED'))
  ) {
    // Returning a rejected duplicate must not overwrite the invoice funded by another applied payment.
    const otherApplied =
      (confirmationSource === 'ADMIN_MANUAL' || confirmationSource === 'SANDBOX_SIMULATION') &&
      refund.payment.application?.status === 'REJECTED'
        ? await tx.paymentApplication.findFirst({
            where: { invoiceId: refund.payment.invoiceId, paymentId: { not: refund.paymentId }, status: 'APPLIED' },
          })
        : null
    if (!otherApplied) {
      const total = await tx.refund.aggregate({
        where: { paymentId: refund.paymentId, status: 'SUCCEEDED' },
        _sum: { amount: true },
      })
      await tx.invoice.update({
        where: { id: refund.payment.invoiceId },
        data: {
          status: total._sum.amount?.equals(refund.payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          version: { increment: 1 },
        },
      })
    }
  }
  if (refund.purpose === 'RENTAL_CANCELLATION' && refund.rentalOrderId) {
    if (event.status === 'SUCCEEDED') {
      const total = await tx.refund.aggregate({
        where: { paymentId: refund.paymentId, status: 'SUCCEEDED' },
        _sum: { amount: true },
      })
      await tx.rentalOrder.updateMany({
        where: { id: refund.rentalOrderId, status: 'CANCELLED' },
        data: {
          financialStatus: total._sum.amount?.equals(refund.payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          version: { increment: 1 },
        },
      })
      const resolved = await tx.rentalExceptionCase?.updateMany({
        where: {
          orderId: refund.rentalOrderId,
          caseType: 'REFUND_FAILURE',
          status: { in: ['OPEN', 'UNDER_REVIEW'] },
          reason: { contains: `[refund:${refund.id}]` },
        },
        data: {
          status: 'RESOLVED',
          adminReviewStatus: confirmationSource === 'SANDBOX_SIMULATION' ? 'RESOLVED_BY_SIMULATION' : 'RESOLVED_BY_PROVIDER',
          resolution: confirmationSource === 'SANDBOX_SIMULATION' ? 'SANDBOX_SIMULATED_REFUND' : 'REFUND_SUCCEEDED',
          resolvedAt: new Date(),
          version: { increment: 1 },
        },
      })
      // payment-recovery đặt đơn ACTION_REQUIRED kèm case REFUND_FAILURE; refund này xong thì gỡ cờ,
      // trừ khi đơn còn vướng việc khác (case khác còn mở, unit chưa trả kho → task BLOCKED).
      if (resolved?.count) {
        const openCases = await tx.rentalExceptionCase.count({
          where: { orderId: refund.rentalOrderId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        })
        const blockedTasks = await tx.inventoryTask.count({
          where: { orderId: refund.rentalOrderId, status: 'BLOCKED' },
        })
        if (openCases === 0 && blockedTasks === 0) {
          await tx.rentalOrder.updateMany({
            where: { id: refund.rentalOrderId, status: 'CANCELLED', exceptionStatus: 'ACTION_REQUIRED' },
            data: { exceptionStatus: 'NONE', version: { increment: 1 } },
          })
        }
      }
    } else if (event.status === 'FAILED' || event.status === 'CANCELLED') {
      await tx.rentalOrder.updateMany({
        where: { id: refund.rentalOrderId, status: 'CANCELLED' },
        data: { exceptionStatus: 'ACTION_REQUIRED', version: { increment: 1 } },
      })
      // The order of a handover-shortage refund is still live, so the flag above does not apply:
      // an admin case makes the failed refund visible and holds the order open until it is paid.
      if (refund.reason === HANDOVER_SHORTAGE_REASON) await openHandoverShortageRefundCase(tx, refund, event.status)
    }
  }
}
