import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

/**
 * Cancellation/no-show reservation for the single original RENTAL payment.
 * Provides provider scope + allocation rows required by PaymentRecoveryService.
 * Must run in the caller's state-transition transaction; payment attempt/settlement
 * remains owned by Shared Payment, never by the rental business adapter.
 */
export async function reserveRentalCancellationRefundWithTx(
  tx: Prisma.TransactionClient,
  input: { orderId: string; paymentId: string; amount: Prisma.Decimal; reason: string;
    idempotencyKey: string; now: Date },
) {
  const existing = await tx.refund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.paymentId !== input.paymentId || !existing.amount.equals(input.amount) ||
        existing.rentalOrderId !== input.orderId) throw new Error('RENTAL_REFUND_IDEMPOTENCY_CONFLICT');
    return existing;
  }
  const paidPayments = await tx.payment.count({
    where: { invoice: { rentalOrderId: input.orderId }, status: 'SUCCEEDED', application: { status: 'APPLIED' } },
  });
  // Never charge a multi-invoice refund to only the initial source payment.
  if (paidPayments !== 1) throw new Error('MULTI_PAYMENT_RENTAL_CANCELLATION_REVIEW_REQUIRED');
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId },
    include: { invoice: true, application: true, allocations: true } });
  if (payment.status !== 'SUCCEEDED' || payment.application?.status !== 'APPLIED' ||
      payment.invoice.rentalOrderId !== input.orderId || payment.invoice.invoiceType !== 'RENTAL' ||
      payment.reconcileStatus === 'NEEDS_REVIEW' || !payment.paymentGateway ||
      !payment.providerEnvironment || !payment.merchantAccountKey || !payment.merchantRequestRef ||
      payment.currency !== 'VND' || input.amount.lte(0) || input.amount.gt(payment.amount)) {
    throw new Error('RENTAL_REFUND_SOURCE_NOT_VERIFIED');
  }
  const prior = await tx.refund.aggregate({
    where: { paymentId: payment.id, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
    _sum: { amount: true },
  });
  if (input.amount.gt(payment.amount.minus(prior._sum.amount ?? 0)))
    throw new Error('RENTAL_REFUND_EXCEEDS_UNREFUNDED_PAYMENT');
  const allocations = payment.allocations.filter(a => ['RENTAL_DEPOSIT', 'RENTAL_FEE'].includes(a.component))
    .sort((a, b) => Number(b.component === 'RENTAL_DEPOSIT') - Number(a.component === 'RENTAL_DEPOSIT'));
  let remaining = input.amount;
  const selected: { paymentAllocationId: string; amount: Prisma.Decimal }[] = [];
  for (const a of allocations) {
    const used = await tx.refundAllocation.aggregate({
      where: { paymentAllocationId: a.id, refund: { status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } } },
      _sum: { amount: true },
    });
    const available = a.amount.minus(used._sum.amount ?? 0);
    const take = available.lessThan(remaining) ? available : remaining;
    if (take.gt(0)) selected.push({ paymentAllocationId: a.id, amount: take });
    remaining = remaining.minus(take);
    if (remaining.isZero()) break;
  }
  if (!remaining.isZero()) throw new Error('RENTAL_REFUND_ALLOCATION_EXCEEDED');
  const id = randomUUID();
  const actionId = `rental-cancellation:${input.orderId}:${input.idempotencyKey}`;
  const requestHash = createHash('sha256').update(JSON.stringify({ paymentId: payment.id,
    amount: input.amount.toFixed(), reason: input.reason, actionId })).digest('hex');
  return tx.refund.create({ data: {
    id, paymentId: payment.id, purpose: 'RENTAL_CANCELLATION',
    rentalOrderId: input.orderId, businessActionId: actionId, requestHash,
    requestHashVersion: 1, amount: input.amount, currency: payment.currency,
    idempotencyKey: input.idempotencyKey, reason: input.reason, status: 'PENDING',
    paymentGateway: payment.paymentGateway, providerEnvironment: payment.providerEnvironment,
    merchantAccountKey: payment.merchantAccountKey, merchantRefundRef: `refund:${id}`,
    reconcileStatus: 'SCHEDULED', nextRetryAt: input.now,
    allocations: { create: selected },
  } });
}
