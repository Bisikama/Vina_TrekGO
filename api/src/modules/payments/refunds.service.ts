import { Injectable } from '@nestjs/common'
import { Prisma, Refund } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { AppError, PAYMENT_ERROR_CODES as E } from '../../shared/errors'
import { PrismaService } from '../../shared/services/prisma.service'
import { VerifiedRefundEvent } from './payment-provider.port'
import { paymentHash, paymentRecoveryConfig } from './payment-utils'
import { DepositRefundCommand, RentalRefundsService } from './rental-refunds.service'
import { isTechnicalReversalReason, type TechnicalReversalReason } from './technical-reversal-reasons'

export type BookingRefundCommand = {
  paymentId: string
  businessActionId: string
  purpose: 'BOOKING_CANCELLATION'
  amount: string
  idempotencyKey: string
  source: { bookingCancellationId: string }
}
export type TechnicalReversalCommand = {
  paymentId: string
  businessActionId: string
  purpose: 'TECHNICAL_REVERSAL'
  reasonCode: TechnicalReversalReason
  amount: string
  idempotencyKey: string
  source: Record<string, never>
}
export type RefundCommand = BookingRefundCommand | TechnicalReversalCommand | DepositRefundCommand
export type RecoveryLease = { token: string; version: number }
export const refundSummary = (r: Refund) => ({
  refundId: r.id,
  paymentId: r.paymentId,
  purpose: r.purpose,
  reasonCode: r.reasonCode,
  amount: r.amount.toFixed(),
  currency: r.currency,
  status: r.status,
  refundedAt: r.refundedAt?.toISOString() ?? null,
  reconciliationRequired: ['SCHEDULED', 'RUNNING', 'NEEDS_REVIEW'].includes(r.reconcileStatus),
})

@Injectable()
export class RefundsService {
  constructor(
    private readonly db: PrismaService,
    private readonly rentalRefunds: RentalRefundsService,
  ) {}

  async requestRefund(input: RefundCommand) {
    if (!/^[1-9][0-9]{0,9}$/.test(input.amount) || !input.idempotencyKey || input.idempotencyKey.length > 200)
      throw AppError.fromCode('VALIDATION_ERROR')
    if (input.purpose === 'TECHNICAL_REVERSAL') return this.reserveReversal(input)
    if (input.purpose === 'DEPOSIT') return refundSummary(await this.rentalRefunds.reserve(input))
    if (
      input.purpose !== 'BOOKING_CANCELLATION' ||
      input.businessActionId !== `booking-cancellation:${input.source.bookingCancellationId}`
    )
      throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
    const amount = new Prisma.Decimal(input.amount)
    const key = paymentHash(['refund', input.paymentId, input.idempotencyKey])
    const requestHash = paymentHash({
      paymentId: input.paymentId,
      businessActionId: input.businessActionId,
      purpose: input.purpose,
      amount: input.amount,
      source: input.source,
    })
    const refund = await this.db.$transaction(async (tx) => {
      const initial = await tx.bookingCancellation.findUnique({
        where: { id: input.source.bookingCancellationId },
        include: { booking: true },
      })
      if (!initial) throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${initial.booking.tripId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${initial.bookingId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM booking_cancellations WHERE id = ${initial.id}::uuid FOR UPDATE`
      const initialPayment = await tx.payment.findUnique({ where: { id: input.paymentId } })
      if (!initialPayment) throw AppError.fromCode(E.PAYMENT_NOT_FOUND)
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${initialPayment.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${input.paymentId}::uuid FOR UPDATE`
      const cancellation = await tx.bookingCancellation.findUniqueOrThrow({
        where: { id: initial.id },
        include: { booking: true },
      })
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: input.paymentId },
        include: { invoice: true, application: true },
      })
      if (
        cancellation.bookingId !== initial.bookingId ||
        cancellation.booking.tripId !== initial.booking.tripId ||
        payment.invoice.bookingId !== cancellation.bookingId ||
        payment.invoice.invoiceType !== 'BOOKING' ||
        payment.invoice.userId !== cancellation.booking.userId ||
        !cancellation.source ||
        !cancellation.idempotencyKey
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      const previous = await tx.refund.findFirst({
        where: { OR: [{ idempotencyKey: key }, { paymentId: payment.id, businessActionId: input.businessActionId }] },
      })
      if (previous) {
        if (previous.requestHash !== requestHash || previous.requestHashVersion !== 1)
          throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return previous // Includes authoritative FAILED: never resubmit/reset it.
      }
      if (
        cancellation.booking.status !== 'CANCELLED' ||
        payment.status !== 'SUCCEEDED' ||
        payment.application?.status !== 'APPLIED' ||
        payment.reconcileStatus === 'NEEDS_REVIEW' ||
        !payment.providerEnvironment ||
        !payment.merchantAccountKey ||
        payment.currency !== 'VND' ||
        payment.currency !== cancellation.booking.currency ||
        (await tx.refund.findFirst({ where: { paymentId: payment.id, reconcileStatus: 'NEEDS_REVIEW' } }))
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      const reserved = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
        _sum: { amount: true },
      })
      const approvedReserved = await tx.refund.aggregate({
        where: { bookingCancellationId: cancellation.id, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
        _sum: { amount: true },
      })
      if (
        amount.gt(payment.amount.minus(reserved._sum.amount ?? 0)) ||
        amount.gt(cancellation.refundableAmount.minus(approvedReserved._sum.amount ?? 0))
      )
        throw AppError.fromCode(E.REFUND_AMOUNT_EXCEEDED)
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      const id = randomUUID()
      return tx.refund.create({
        data: {
          id,
          paymentId: payment.id,
          purpose: input.purpose,
          amount,
          currency: payment.currency,
          bookingCancellationId: cancellation.id,
          businessActionId: input.businessActionId,
          idempotencyKey: key,
          paymentGateway: payment.paymentGateway,
          providerEnvironment: payment.providerEnvironment,
          merchantAccountKey: payment.merchantAccountKey,
          merchantRefundRef: `refund:${id}`,
          requestHash,
          requestHashVersion: 1,
          reconcileStatus: 'SCHEDULED',
          nextRetryAt: now,
        },
      })
    })
    return refundSummary(refund)
  }

  private async reserveReversal(input: TechnicalReversalCommand) {
    const action = `payment:${input.paymentId}:technical-reversal:v1`
    if (input.businessActionId !== action || Object.keys(input.source).length)
      throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
    const requestHash = paymentHash({ ...input, idempotencyKey: undefined })
    const key = paymentHash(['refund', input.paymentId, input.idempotencyKey])
    const refund = await this.db.$transaction(async (tx) => {
      const initial = await tx.payment.findUnique({ where: { id: input.paymentId } })
      if (!initial) throw AppError.fromCode(E.PAYMENT_NOT_FOUND)
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${initial.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${initial.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_allocations WHERE payment_id = ${initial.id}::uuid ORDER BY id FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_applications WHERE payment_id = ${initial.id}::uuid FOR UPDATE`
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: initial.id },
        include: { application: true, invoice: true, allocations: { include: { rentalOrderLine: true } } },
      })
      const decision = await tx.paymentOutboxEvent.findUnique({
        where: {
          deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1`,
        },
      })
      const payload = decision?.payload as Prisma.JsonObject | undefined
      // Kiểm tra lại trong transaction: event Rental không được mở quyền hoàn cho hóa đơn Booking/Trail.
      if (
        payment.invoiceId !== initial.invoiceId ||
        payment.status !== 'SUCCEEDED' ||
        !['BOOKING', 'TRAIL_ACCESS', 'RENTAL'].includes(payment.invoice.invoiceType) ||
        payment.application?.status !== 'REJECTED' ||
        payment.application.invoiceId !== payment.invoiceId ||
        payment.application.reasonCode !== input.reasonCode ||
        !isTechnicalReversalReason(payment.invoice.invoiceType, input.reasonCode) ||
        !decision ||
        decision.eventType !== 'TECHNICAL_REVERSAL_REQUESTED' ||
        decision.aggregateType !== 'Payment' ||
        decision.aggregateId !== payment.id ||
        payload?.schemaVersion !== 1 ||
        payload.paymentId !== payment.id ||
        payload.invoiceId !== payment.invoiceId ||
        payload.reasonCode !== input.reasonCode ||
        !payment.amount.equals(input.amount)
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      const previous = await tx.refund.findFirst({
        where: { OR: [{ idempotencyKey: key }, { paymentId: payment.id, businessActionId: action }] },
      })
      if (previous) {
        if (previous.requestHash !== requestHash || previous.requestHashVersion !== 1)
          throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return previous
      }
      if (
        payment.reconcileStatus === 'NEEDS_REVIEW' ||
        !payment.providerEnvironment ||
        !payment.merchantAccountKey ||
        !payment.merchantRequestRef ||
        payment.currency !== 'VND' ||
        (await tx.refund.findFirst({ where: { paymentId: payment.id, reconcileStatus: 'NEEDS_REVIEW' } }))
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      const exposure = await tx.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] },
        },
        _sum: { amount: true },
      })
      if (new Prisma.Decimal(input.amount).gt(payment.amount.minus(exposure._sum.amount ?? 0)))
        throw AppError.fromCode(E.REFUND_AMOUNT_EXCEEDED)
      const id = randomUUID()
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (
        payment.invoice.invoiceType === 'RENTAL' &&
        (!payment.allocations.length ||
          payment.allocations.some((a) => a.rentalOrderLine.orderId !== payment.invoice.rentalOrderId) ||
          !payment.allocations.reduce((n, a) => n.plus(a.amount), new Prisma.Decimal(0)).equals(payment.amount))
      )
        throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
      return tx.refund.create({
        data: {
          id,
          paymentId: payment.id,
          purpose: 'TECHNICAL_REVERSAL',
          reasonCode: input.reasonCode,
          businessActionId: action,
          amount: payment.amount,
          currency: payment.currency,
          idempotencyKey: key,
          requestHash,
          requestHashVersion: 1,
          paymentGateway: payment.paymentGateway,
          providerEnvironment: payment.providerEnvironment,
          merchantAccountKey: payment.merchantAccountKey,
          merchantRefundRef: `refund:${id}`,
          reconcileStatus: 'SCHEDULED',
          nextRetryAt: now,
          allocations: { create: payment.allocations.map((a) => ({ paymentAllocationId: a.id, amount: a.amount })) },
        },
      })
    })
    return refundSummary(refund)
  }

  async applyEvent(
    event: VerifiedRefundEvent,
    options: { inboxId?: string; lease?: RecoveryLease; refundId?: string } = {},
  ) {
    return this.db.$transaction(async (tx) => {
      if (event.refundTransactionRef) {
        const identity = paymentHash([
          event.gateway,
          event.environment,
          event.merchantAccountKey,
          event.refundTransactionRef,
        ])
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))::text`
      }
      const initial = await tx.refund.findFirst({
        where: {
          paymentGateway: event.gateway,
          providerEnvironment: event.environment,
          merchantAccountKey: event.merchantAccountKey,
          merchantRefundRef: event.merchantRefundRef,
        },
        include: { payment: true },
      })
      if (!initial) {
        if (options.inboxId)
          await tx.paymentWebhookEvent.updateMany({
            where: { id: options.inboxId, processingStatus: { in: ['RECEIVED', 'RETRY'] } },
            data: { processingStatus: 'NEEDS_REVIEW', errorMessage: 'REFUND_NOT_FOUND' },
          })
        return false
      }
      // Cùng thứ tự khóa với luồng hủy Rental: order trước invoice/payment.
      if (initial.purpose === 'RENTAL_CANCELLATION' && initial.rentalOrderId)
        await tx.$queryRaw`SELECT id FROM rental_orders WHERE id = ${initial.rentalOrderId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${initial.payment.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${initial.paymentId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_allocations WHERE payment_id = ${initial.paymentId}::uuid ORDER BY id FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM refunds WHERE id = ${initial.id}::uuid FOR UPDATE`
      const refund = await tx.refund.findUniqueOrThrow({
        where: { id: initial.id },
        include: { payment: { include: { application: true } } },
      })
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (
        options.lease &&
        (options.refundId !== refund.id ||
          refund.leaseToken !== options.lease.token ||
          refund.version !== options.lease.version ||
          !refund.leaseUntil ||
          refund.leaseUntil <= now)
      )
        return false
      if (options.inboxId) {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM payment_webhook_events WHERE id = ${options.inboxId}::uuid
          AND processing_status IN ('RECEIVED','RETRY') FOR UPDATE SKIP LOCKED`
        if (!rows.length) return false
      }
      let reason: string | null = null
      if (
        refund.paymentId !== initial.paymentId ||
        refund.payment.invoiceId !== initial.payment.invoiceId ||
        refund.payment.merchantRequestRef !== event.merchantRequestRef ||
        refund.payment.currency !== event.currency ||
        !refund.amount.equals(event.amount) ||
        refund.currency !== event.currency ||
        (event.transactionRef && event.transactionRef !== refund.payment.transactionRef)
      )
        reason = 'REFUND_RESULT_MISMATCH'
      if (
        event.refundTransactionRef &&
        refund.refundTransactionRef &&
        event.refundTransactionRef !== refund.refundTransactionRef
      )
        reason = 'REFUND_TRANSACTION_MISMATCH'
      if (
        event.refundTransactionRef &&
        (await tx.refund.findFirst({
          where: {
            id: { not: refund.id },
            paymentGateway: event.gateway,
            providerEnvironment: event.environment,
            merchantAccountKey: event.merchantAccountKey,
            refundTransactionRef: event.refundTransactionRef,
          },
        }))
      )
        reason = 'REFUND_TRANSACTION_ALREADY_RECORDED'
      if (
        refund.reconcileStatus === 'NEEDS_REVIEW' ||
        (options.lease &&
          refund.lastErrorCode &&
          !['PAYMENT_PROVIDER_UNAVAILABLE', 'RECOVERY_UNKNOWN'].includes(refund.lastErrorCode))
      )
        reason = reason ?? 'REFUND_REVIEW_REQUIRED'
      const terminal = !['PENDING', 'PROCESSING'].includes(refund.status)
      if (terminal && refund.status !== event.status && event.status === 'SUCCEEDED')
        reason = 'REFUND_TERMINAL_CORRECTION'
      if (reason) {
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            reconcileStatus: 'NEEDS_REVIEW',
            lastErrorCode: reason,
            nextRetryAt: options.lease ? null : new Date(now.getTime() + paymentRecoveryConfig().retrySeconds * 1000),
            lastCheckedAt: options.lease ? now : refund.lastCheckedAt,
            leaseToken: null,
            leaseUntil: null,
            version: { increment: 1 },
          },
        })
        await tx.auditLog.create({
          data: {
            action: 'REFUND_RESULT_NEEDS_REVIEW',
            entityType: 'Refund',
            entityId: refund.id,
            newValues: { reason, event: { ...event } },
          },
        })
      } else if (!terminal) {
        await tx.refund.update({
          where: { id: refund.id },
          data: {
            status: event.status,
            refundTransactionRef: event.refundTransactionRef,
            refundedAt: event.status === 'SUCCEEDED' ? new Date(event.occurredAt) : null,
            reconcileStatus: event.status === 'PROCESSING' ? 'SCHEDULED' : 'RESOLVED',
            nextRetryAt:
              event.status === 'PROCESSING'
                ? new Date(now.getTime() + paymentRecoveryConfig().retrySeconds * 1000)
                : null,
            leaseToken: null,
            leaseUntil: null,
            lastCheckedAt: options.lease ? now : refund.lastCheckedAt,
            lastErrorCode: null,
            version: { increment: 1 },
          },
        })
        if (event.status === 'SUCCEEDED' || event.status === 'FAILED') {
          await tx.paymentOutboxEvent.create({
            data: {
              deduplicationKey: `refund:${refund.id}:${event.status.toLowerCase()}:v1`,
              eventType: `REFUND_${event.status}`,
              aggregateType: 'Refund',
              aggregateId: refund.id,
              payload: {
                schemaVersion: 1,
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
          } else if (event.status === 'FAILED' || event.status === 'CANCELLED') {
            await tx.rentalOrder.updateMany({
              where: { id: refund.rentalOrderId, status: 'CANCELLED' },
              data: { exceptionStatus: 'ACTION_REQUIRED', version: { increment: 1 } },
            })
          }
        }
      } else {
        if (options.lease)
          await tx.refund.update({
            where: { id: refund.id },
            data: {
              reconcileStatus: 'RESOLVED',
              nextRetryAt: null,
              leaseToken: null,
              leaseUntil: null,
              lastCheckedAt: now,
              version: { increment: 1 },
            },
          })
        await tx.auditLog.create({
          data: {
            action: 'REFUND_RESULT_IGNORED',
            entityType: 'Refund',
            entityId: refund.id,
            newValues: {
              status: event.status,
              reason: refund.status === event.status ? 'DUPLICATE_RESULT' : 'OUT_OF_ORDER_RESULT',
            },
          },
        })
      }
      if (options.inboxId)
        await tx.paymentWebhookEvent.update({
          where: { id: options.inboxId },
          data: {
            paymentId: refund.paymentId,
            refundId: refund.id,
            processingStatus: reason ? 'NEEDS_REVIEW' : 'PROCESSED',
            processed: !reason,
            processedAt: reason ? null : now,
            nextRetryAt: null,
            errorMessage: reason,
            attemptCount: { increment: 1 },
          },
        })
      return true
    })
  }
}
