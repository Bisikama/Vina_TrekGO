import { Prisma } from '@prisma/client'

type SettledRefund = Prisma.RefundGetPayload<{ include: { payment: { include: { application: true } } } }>
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
      confirmationSource === 'ADMIN_MANUAL' && refund.payment.application?.status === 'REJECTED'
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
    }
  }
}
