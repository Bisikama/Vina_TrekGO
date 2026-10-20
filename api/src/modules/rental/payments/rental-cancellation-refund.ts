import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

export type LifecycleCancellationSource = 'TRIP' | 'BOOKING';
export type LifecycleRentalFinancialResult = {
  financialStatus: 'UNPAID' | 'PAID' | 'REFUND_PENDING' | null;
  reviewReason: string | null;
};

/**
 * SOT trước bàn giao: hệ thống hủy Trip hoàn toàn bộ; USER hủy Booking sau hạn
 * miễn phí chỉ giữ phí thuê. Chỉ tự hoàn khi nguồn thanh toán gốc được xác thực.
 */
export async function reserveLifecycleRentalRefundWithTx(
  tx: Prisma.TransactionClient,
  input: {
    order: {
      id: string; status: string; financialStatus: string;
      bookingId: string | null; rentalFee: Prisma.Decimal; totalDeposit: Prisma.Decimal;
      rentalStartAt: Date; rentalPolicy: { freeCancellationHours: number };
    };
    source: LifecycleCancellationSource;
    eventVersion: number;
    now: Date;
    reason: string;
  },
): Promise<LifecycleRentalFinancialResult> {
  const { order, source, now } = input;
  if (order.status === 'PENDING_PAYMENT') return { financialStatus: 'UNPAID', reviewReason: null };
  if (order.financialStatus === 'REFUND_PENDING') return { financialStatus: 'REFUND_PENDING', reviewReason: null };
  if (order.financialStatus !== 'PAID')
    return { financialStatus: null, reviewReason: 'RENTAL_CANCELLATION_FINANCIAL_STATE_UNVERIFIED' };
  if (!order.totalDeposit || !order.rentalFee ||
      typeof order.totalDeposit.plus !== 'function' || typeof order.rentalFee.plus !== 'function')
    return { financialStatus: 'PAID', reviewReason: 'RENTAL_CANCELLATION_AMOUNT_UNVERIFIED' };

  let refundFee = source === 'TRIP';
  if (source === 'BOOKING') {
    if (!order.bookingId) return { financialStatus: 'PAID', reviewReason: 'BOOKING_CANCELLATION_SOURCE_UNVERIFIED' };
    const cancellation = await tx.bookingCancellation.findFirst({
      where: { bookingId: order.bookingId }, orderBy: { cancelledAt: 'desc' },
      select: { source: true, cancelledAt: true },
    });
    if (!cancellation?.source) return { financialStatus: 'PAID', reviewReason: 'BOOKING_CANCELLATION_SOURCE_UNVERIFIED' };
    if (cancellation.source === 'USER') {
      const hours = order.rentalPolicy?.freeCancellationHours;
      if (!Number.isSafeInteger(hours) || hours < 0)
        return { financialStatus: 'PAID', reviewReason: 'RENTAL_CANCELLATION_POLICY_UNVERIFIED' };
      refundFee = cancellation.cancelledAt.getTime() <= order.rentalStartAt.getTime() - hours * 3_600_000;
    } else {
      refundFee = true; // ORGANIZER/ADMIN hủy trước bàn giao theo nhánh TrekGo.
    }
  }

  const amount = order.totalDeposit.plus(refundFee ? order.rentalFee : 0);
  if (amount.lte(0)) return { financialStatus: 'PAID', reviewReason: null };
  const appliedExtensions = await tx.rentalExtensionRequest.count({ where: { orderId: order.id, status: 'APPLIED' } });
  if (appliedExtensions > 0)
    return { financialStatus: 'PAID', reviewReason: 'MULTI_PAYMENT_RENTAL_CANCELLATION_REVIEW_REQUIRED' };
  const payments = await tx.payment.findMany({
    where: { invoice: { rentalOrderId: order.id }, status: 'SUCCEEDED', application: { status: 'APPLIED' } },
    select: { id: true, amount: true },
  });
  if (payments.length !== 1)
    return { financialStatus: 'PAID', reviewReason: 'MULTI_PAYMENT_RENTAL_CANCELLATION_REVIEW_REQUIRED' };
  if (amount.gt(payments[0].amount))
    return { financialStatus: 'PAID', reviewReason: 'RENTAL_REFUND_EXCEEDS_SOURCE_PAYMENT' };

  let refund;
  try {
    refund = await reserveRentalCancellationRefundWithTx(tx, {
      orderId: order.id, paymentId: payments[0].id, amount,
      reason: input.reason,
      idempotencyKey: `rental-${source.toLowerCase()}-cancel:${order.id}:v${input.eventVersion}`,
      now,
    });
  } catch (failure) {
    // Lỗi đối soát nghiệp vụ được đưa vào hàng xử lý thủ công; lỗi DB phải rollback để retry.
    if (failure instanceof Error && /^(RENTAL_REFUND_|MULTI_PAYMENT_RENTAL_CANCELLATION_)/.test(failure.message))
      return { financialStatus: 'PAID', reviewReason: failure.message };
    throw failure;
  }
  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey: `refund-request:${refund.id}` }, update: {},
    create: {
      deduplicationKey: `refund-request:${refund.id}`, eventType: 'RENTAL_REFUND_REQUESTED',
      aggregateType: 'RentalOrder', aggregateId: order.id,
      payload: { refundRef: refund.id, paymentRef: payments[0].id, rentalOrderId: order.id,
        component: 'ORDER_CANCELLATION', amount: amount.toFixed(), currency: 'VND', reason: input.reason },
    },
  });
  return { financialStatus: 'REFUND_PENDING', reviewReason: null };
}

/** Hủy các khoản chưa thu của đơn Rental trong cùng transaction với trạng thái CANCELLED. */
export async function cancelPendingRentalChargesWithTx(tx: Prisma.TransactionClient, orderId: string) {
  const invoices = await tx.invoice.findMany({ where: { rentalOrderId: orderId }, select: { id: true } });
  await tx.invoice.updateMany({
    where: { rentalOrderId: orderId, status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
    data: { status: 'CANCELLED', version: { increment: 1 } },
  });
  if (invoices.length) {
    await tx.payment.updateMany({
      where: { invoiceId: { in: invoices.map((invoice) => invoice.id) }, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
  }
}

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
