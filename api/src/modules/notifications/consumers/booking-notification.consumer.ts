import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import envConfig from '../../../shared/config'
import { PrismaService } from '../../../shared/services/prisma.service'
import { NotificationsService } from '../notifications.service'
import {
  BookingNotificationContext,
  bookingCancelledByOthers,
  bookingNotificationEvents,
  bookingNotificationProjection,
} from './booking-notification.projection'

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
          const context = await this.loadContext(event)
          for (const delivery of bookingNotificationProjection(event.eventType, event.payload, context))
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

  /** Tra người nhận phụ; chỉ chạy cho các event cần (giữ nguyên chi phí cho event khác). */
  private async loadContext(event: Event): Promise<BookingNotificationContext> {
    const payload = (event.payload ?? {}) as Record<string, unknown>
    if (event.eventType === 'BOOKING_CANCELLED' && bookingCancelledByOthers(payload) && typeof payload.bookingId === 'string') {
      const participants = await this.db.bookingParticipant.findMany({
        // Huỷ booking chuyển participant ACTIVE → CANCELLED, nên chỉ loại người đã kết thúc vé trước đó.
        where: { bookingId: payload.bookingId, userId: { not: null }, status: { notIn: ['NO_SHOW', 'COMPLETED'] } },
        select: { userId: true },
      })
      return { participantUserIds: participants.map((p) => p.userId!) }
    }
    if (
      (event.eventType === 'PRIVATE_TRIP_CANCELLED' || event.eventType === 'PRIVATE_TRIP_UPDATED') &&
      typeof payload.tripId === 'string'
    ) {
      // Huỷ Trip riêng không đổi trạng thái thành viên, nên thành viên ACTIVE lúc này là người cần báo.
      const members = await this.db.tripMember.findMany({
        where: { tripId: payload.tripId, status: 'ACTIVE' },
        select: { userId: true },
      })
      return { memberUserIds: members.map((m) => m.userId) }
    }
    return {}
  }
}
