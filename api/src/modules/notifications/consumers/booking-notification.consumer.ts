import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import envConfig from '../../../shared/config'
import { PrismaService } from '../../../shared/services/prisma.service'
import { NotificationsService } from '../notifications.service'
import { bookingNotificationEvents, bookingNotificationProjection } from './booking-notification.projection'

const consumer = 'booking-notifications-v1'
type Event = { id: string; eventType: string; payload: unknown }
@Injectable()
export class BookingNotificationConsumer {
  private readonly logger = new Logger(BookingNotificationConsumer.name)
  private isProcessing = false
  constructor(
    private readonly db: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Interval(3000)
  async tick() {
    if (this.isProcessing || !envConfig.NOTIFICATION_CONSUMER_ENABLED) return
    this.isProcessing = true
    try {
      await this.processBookingEvents()
    } catch {
      this.logger.error('Booking notification scanner failed; retry on next tick')
    } finally {
      this.isProcessing = false
    }
  }

  async processBookingEvents() {
    // Bounded work per tick. Receipts exclude delivered events so subsequent ticks drain the backlog.
    for (let batch = 0; batch < 4; batch++) {
      const events = await this.db.$queryRaw<Event[]>(Prisma.sql`
        SELECT e.id, e.event_type AS "eventType", e.payload FROM booking_outbox_events e
        LEFT JOIN booking_notification_receipts r ON r.event_id=e.id AND r.consumer=${consumer}
        WHERE e.event_type IN (${Prisma.join(bookingNotificationEvents)})
          AND r.completed_at IS NULL AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= now())
        ORDER BY e.created_at ASC, e.id ASC LIMIT 25
      `)
      if (!events.length) break
      for (const event of events) {
        try {
          for (const delivery of bookingNotificationProjection(event.eventType, event.payload))
            await this.notificationsService.deliverBookingEvent(event.id, delivery.semanticType, delivery.data)
          // Mongo insert may succeed before this write. Unique delivery keys make replay safe.
          await this.db
            .$executeRaw`INSERT INTO booking_notification_receipts(event_id, consumer, completed_at, attempts)
            VALUES (${event.id}::uuid, ${consumer}, now(), 1)
            ON CONFLICT (event_id, consumer) DO UPDATE SET completed_at=now(), last_error=NULL,
              attempts=booking_notification_receipts.attempts + 1
            WHERE booking_notification_receipts.completed_at IS NULL`
        } catch {
          // No payload or driver errors in logs. A failed event does not block newer events.
          await this.db
            .$executeRaw`INSERT INTO booking_notification_receipts(event_id, consumer, attempts, next_attempt_at, last_error)
            VALUES (${event.id}::uuid, ${consumer}, 1, now() + interval '3 seconds', 'DELIVERY_FAILED')
            ON CONFLICT (event_id, consumer) DO UPDATE SET
              attempts=booking_notification_receipts.attempts + 1,
              next_attempt_at=now() + interval '1 second' * LEAST(300, 3 * power(2, LEAST(7, booking_notification_receipts.attempts))),
              last_error='DELIVERY_FAILED'
            WHERE booking_notification_receipts.completed_at IS NULL`
          this.logger.warn(`Booking notification delivery pending retry: ${event.id}`)
        }
      }
    }
  }
}
