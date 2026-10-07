import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'

const CONSUMER = 'trail-payment-application-v1'

@Injectable()
export class ApplyTrailPaymentUseCase {
  constructor(private readonly db: PrismaService) {}
  async consume(eventId: string) {
    await this.db.$transaction(async (tx) => {
      const event = await tx.paymentOutboxEvent.findUnique({ where: { id: eventId } })
      if (!event || event.eventType !== 'PAYMENT_SUCCEEDED' || event.aggregateType !== 'Payment') return
      const initial = await tx.payment.findUnique({
        where: { id: event.aggregateId },
        include: { invoice: { include: { trailAccess: true } } },
      })
      if (!initial || initial.invoice.invoiceType !== 'TRAIL_ACCESS' || !initial.invoice.trailAccess) return
      const source = initial.invoice.trailAccess
      await tx.$queryRaw`SELECT id FROM system_trails WHERE id = ${source.systemTrailId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM trail_accesses WHERE id = ${source.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${initial.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${initial.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_applications WHERE payment_id = ${initial.id}::uuid FOR UPDATE`
      const claimed = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM payment_outbox_events WHERE id = ${eventId}::uuid AND status = 'PENDING'
        AND (next_retry_at IS NULL OR next_retry_at <= clock_timestamp()) FOR UPDATE SKIP LOCKED`
      if (!claimed.length) return
      const currentEvent = await tx.paymentOutboxEvent.findUniqueOrThrow({ where: { id: eventId } })
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: initial.id },
        include: { invoice: true, application: true },
      })
      const access = await tx.trailAccess.findUniqueOrThrow({
        where: { id: source.id },
        include: { systemTrail: true },
      })
      const payload = currentEvent.payload as Record<string, unknown>
      if (
        payment.invoiceId !== initial.invoiceId ||
        payment.invoice.trailAccessId !== access.id ||
        access.systemTrailId !== source.systemTrailId ||
        payload.schemaVersion !== 1 ||
        payload.paymentId !== payment.id ||
        payload.invoiceId !== payment.invoiceId ||
        payment.status !== 'SUCCEEDED' ||
        !payment.application ||
        payment.application.invoiceId !== payment.invoiceId
      )
        throw new Error('Invalid trail payment application mapping')
      if (payment.reconcileStatus === 'NEEDS_REVIEW') throw new Error('Payment requires review before trail grant')
      const receipt = await tx.paymentConsumerReceipt.findUnique({
        where: { eventId_consumerName: { eventId, consumerName: CONSUMER } },
      })
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (!receipt && payment.application.status === 'PENDING') {
        const invoice = payment.invoice
        const other = await tx.paymentApplication.findFirst({
          where: {
            status: 'APPLIED',
            paymentId: { not: payment.id },
            invoice: { trailAccessId: access.id },
          },
        })
        let reason: string | null = null
        if (other || access.status === 'ACTIVE') reason = 'DUPLICATE_PAYMENT'
        else if (
          access.status !== 'PENDING_PAYMENT' ||
          access.sourceType !== 'PURCHASE' ||
          access.systemTrail.status !== 'ACTIVE' ||
          access.systemTrail.archivedAt ||
          invoice.invoiceType !== 'TRAIL_ACCESS' ||
          invoice.userId !== access.userId ||
          invoice.status !== 'PENDING_PAYMENT' ||
          invoice.currency !== 'VND' ||
          payment.currency !== invoice.currency ||
          !payment.amount.equals(invoice.totalAmount) ||
          !invoice.totalAmount.equals(access.priceSnapshot) ||
          !invoice.subtotalAmount.equals(invoice.totalAmount) ||
          !invoice.discountAmount.isZero() ||
          (invoice.expiresAt && invoice.expiresAt <= now)
        )
          reason = 'DOMAIN_NOT_ELIGIBLE'
        if (reason) {
          await tx.paymentApplication.update({
            where: { paymentId: payment.id },
            data: { status: 'REJECTED', reasonCode: reason, decidedAt: now },
          })
          await tx.paymentOutboxEvent.create({
            data: {
              deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1`,
              eventType: 'TECHNICAL_REVERSAL_REQUESTED',
              aggregateType: 'Payment',
              aggregateId: payment.id,
              payload: { schemaVersion: 1, paymentId: payment.id, invoiceId: invoice.id, reasonCode: reason },
            },
          })
        } else {
          await tx.trailAccess.update({
            where: { id: access.id },
            data: { status: 'ACTIVE', purchasedAt: payment.paidAt, activatedAt: now },
          })
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID', paidAt: payment.paidAt, version: { increment: 1 } },
          })
          await tx.paymentApplication.update({
            where: { paymentId: payment.id },
            data: { status: 'APPLIED', appliedAt: now, decidedAt: now },
          })
          await tx.paymentOutboxEvent.create({
            data: {
              deduplicationKey: `trail-access:${access.id}:activated:v1`,
              eventType: 'TRAIL_ACCESS_ACTIVATED',
              aggregateType: 'TrailAccess',
              aggregateId: access.id,
              payload: {
                schemaVersion: 1,
                trailAccessId: access.id,
                systemTrailId: access.systemTrailId,
                paymentId: payment.id,
                invoiceId: invoice.id,
              },
            },
          })
        }
      }
      if (!receipt) await tx.paymentConsumerReceipt.create({ data: { eventId, consumerName: CONSUMER } })
      await tx.paymentOutboxEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSED', processedAt: now, lastError: null, nextRetryAt: null },
      })
    })
  }
}
