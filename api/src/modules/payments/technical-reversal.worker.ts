import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { PrismaService } from '../../shared/services/prisma.service'
import { PaymentsPort } from './payments.port'
import { TechnicalReversalCommand } from './refunds.service'
import { isTechnicalReversalReason } from './technical-reversal-reasons'

@Injectable()
export class TechnicalReversalWorker {
  private running = false
  private readonly logger = new Logger(TechnicalReversalWorker.name)
  constructor(
    private readonly db: PrismaService,
    private readonly payments: PaymentsPort,
  ) {}

  async consume(eventId: string) {
    const event = await this.db.paymentOutboxEvent.findUnique({ where: { id: eventId } })
    if (
      !event ||
      event.status !== 'PENDING' ||
      event.eventType !== 'TECHNICAL_REVERSAL_REQUESTED' ||
      event.aggregateType !== 'Payment'
    )
      return
    const payment = await this.db.payment.findUniqueOrThrow({
      where: { id: event.aggregateId },
      include: { invoice: { select: { invoiceType: true } } },
    })
    const payload = event.payload as Record<string, unknown>
    // Đối chiếu loại hóa đơn trước khi cho phép lý do hoàn tiền riêng của Rental.
    if (
      payload.schemaVersion !== 1 ||
      payload.paymentId !== payment.id ||
      payload.invoiceId !== payment.invoiceId ||
      !isTechnicalReversalReason(payment.invoice.invoiceType, payload.reasonCode)
    )
      throw new Error('Invalid technical reversal decision')
    const action = `payment:${payment.id}:technical-reversal:v1`
    const refund = await this.payments.requestRefund({
      paymentId: payment.id,
      businessActionId: action,
      purpose: 'TECHNICAL_REVERSAL',
      reasonCode: payload.reasonCode,
      amount: payment.amount.toFixed(),
      idempotencyKey: action,
      source: {},
    })
    // Reservation is idempotent: crash before acknowledging simply replays the same Refund.
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payment_outbox_events WHERE id = ${eventId}::uuid FOR UPDATE`
      await tx.paymentConsumerReceipt.upsert({
        where: { eventId_consumerName: { eventId, consumerName: 'technical-reversal-v1' } },
        create: { eventId, consumerName: 'technical-reversal-v1' },
        update: {},
      })
      await tx.paymentOutboxEvent.update({
        where: { id: eventId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          nextRetryAt: null,
          lastError: null,
        },
      })
    })
    return refund
  }

  @Interval(2000)
  async tick() {
    if (this.running || process.env.PAYMENT_EVENTS_WORKER_ENABLED === 'false') return
    this.running = true
    try {
      const events = await this.db.$queryRaw<{ id: string }[]>`
        SELECT id FROM payment_outbox_events WHERE status = 'PENDING'
        AND event_type = 'TECHNICAL_REVERSAL_REQUESTED' AND aggregate_type = 'Payment'
        AND (next_retry_at IS NULL OR next_retry_at <= clock_timestamp()) ORDER BY created_at, id LIMIT 25`
      for (const event of events) {
        try {
          await this.consume(event.id)
        } catch {
          await this.db.$executeRaw`UPDATE payment_outbox_events SET retry_count = retry_count + 1,
            status = CASE WHEN retry_count >= 7 THEN 'FAILED'::event_status ELSE 'PENDING'::event_status END,
            next_retry_at = clock_timestamp() + interval '30 seconds', last_error = 'TECHNICAL_REVERSAL_DEFERRED'
            WHERE id = ${event.id}::uuid AND status = 'PENDING'`
          this.logger.warn(`Technical reversal deferred: ${event.id}`)
        }
      }
    } catch {
      this.logger.warn('Technical reversal worker unavailable; durable decisions retained')
    } finally {
      this.running = false
    }
  }
}
