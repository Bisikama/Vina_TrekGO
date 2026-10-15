import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { paymentFailure } from './payment-transaction'
import { PrismaService } from '../../shared/services/prisma.service'
import { BookingPaymentConsumer } from '../bookings/booking-payment.consumer'
import { PaymentWebhooksService } from './payment-webhooks.service'
import { ApplyTrailPaymentUseCase } from '../system-trail/application/use-cases/apply-trail-payment.use-case'
import { RentalPaymentConsumer } from '../rental/payments/rental-payment.consumer'

@Injectable()
export class PaymentEventsWorker {
  private readonly logger = new Logger(PaymentEventsWorker.name)
  private running = false
  constructor(
    private readonly db: PrismaService,
    private readonly inbox: PaymentWebhooksService,
    private readonly booking: BookingPaymentConsumer,
    private readonly trail: ApplyTrailPaymentUseCase,
    private readonly rental: RentalPaymentConsumer,
  ) {}

  // Work is database-only in short transactions. Row locks are released on crash;
  // there is no network call or external side effect requiring an expiring lease here.
  @Interval(1000)
  async tick() {
    if (this.running || process.env.PAYMENT_EVENTS_WORKER_ENABLED === 'false') return
    this.running = true
    try {
      const events = await this.db.$queryRaw<{ id: string }[]>`
        SELECT id FROM payment_webhook_events WHERE processing_status IN ('RECEIVED', 'RETRY')
        AND verified_at IS NOT NULL
        AND (next_retry_at IS NULL OR next_retry_at <= clock_timestamp()) ORDER BY received_at, id LIMIT 25`
      for (const event of events) {
        try {
          await this.inbox.process(event.id)
        } catch (error) {
          this.logger.warn({
            message: 'Payment inbox processing deferred',
            eventId: event.id,
            ...paymentFailure(error),
          })
          await this.db.$executeRaw`UPDATE payment_webhook_events SET attempt_count = attempt_count + 1,
            processing_status = CASE WHEN attempt_count >= 7 THEN 'NEEDS_REVIEW'::payment_webhook_processing_status ELSE 'RETRY'::payment_webhook_processing_status END,
            next_retry_at = clock_timestamp() + interval '30 seconds', error_message = 'INBOX_PROCESSING_FAILED'
            WHERE id = ${event.id}::uuid AND processing_status IN ('RECEIVED', 'RETRY')`
        }
      }
      const outbox = await this.db.$queryRaw<{ id: string; invoiceType: string }[]>`
        SELECT e.id, i.invoice_type::text AS "invoiceType" FROM payment_outbox_events e JOIN payments p ON p.id = e.aggregate_id
        JOIN invoices i ON i.id = p.invoice_id
        WHERE e.status = 'PENDING' AND e.event_type = 'PAYMENT_SUCCEEDED' AND e.aggregate_type = 'Payment'
        AND i.invoice_type IN ('BOOKING', 'TRAIL_ACCESS', 'RENTAL') AND (e.next_retry_at IS NULL OR e.next_retry_at <= clock_timestamp())
        ORDER BY e.created_at, e.id LIMIT 25`
      for (const event of outbox) {
        try {
          if (event.invoiceType === 'TRAIL_ACCESS') await this.trail.consume(event.id)
          else if (event.invoiceType === 'RENTAL') await this.rental.consume(event.id)
          else await this.booking.consume(event.id)
        } catch (error) {
          await this.db.$executeRaw`UPDATE payment_outbox_events SET retry_count = retry_count + 1,
            status = CASE WHEN retry_count >= 7 THEN 'FAILED'::event_status ELSE 'PENDING'::event_status END,
            next_retry_at = clock_timestamp() + interval '30 seconds', last_error = 'DOMAIN_APPLICATION_DEFERRED'
            WHERE id = ${event.id}::uuid AND status = 'PENDING'`
          this.logger.warn({
            message: 'Payment domain application deferred',
            eventId: event.id,
            ...paymentFailure(error),
          })
        }
      }
    } catch (error) {
      this.logger.warn({
        message: 'Payment event worker unavailable; durable rows retained for the next tick',
        ...paymentFailure(error),
      })
    } finally {
      this.running = false
    }
  }
}
