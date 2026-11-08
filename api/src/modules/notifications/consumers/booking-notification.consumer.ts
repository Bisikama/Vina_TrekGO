import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import envConfig from '../../../shared/config'
import { PrismaService } from '../../../shared/services/prisma.service'
import { NotificationsService } from '../notifications.service'
import { drainNotificationOutbox, NOTIFICATION_OUTBOX_SOURCES, NotificationOutboxEvent } from './notification-outbox-drain'
import {
  BookingNotificationContext,
  bookingCancelledByOthers,
  bookingNotificationEvents,
  bookingNotificationProjection,
} from './booking-notification.projection'

const consumer = 'booking-notifications-v1'
type Event = NotificationOutboxEvent
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

  /** Quét/retry/receipt dùng chung với rental và payment (notification-outbox-drain). */
  processBookingEvents() {
    return drainNotificationOutbox({
      db: this.db,
      source: NOTIFICATION_OUTBOX_SOURCES.booking,
      consumer,
      eventTypes: bookingNotificationEvents,
      deliver: (event) => this.deliver(event),
      logger: this.logger,
    })
  }

  private async deliver(event: Event) {
    const context = await this.loadContext(event)
    for (const delivery of bookingNotificationProjection(event.eventType, event.payload, context))
      await this.notificationsService.deliverBookingEvent(event.id, delivery.semanticType, delivery.data)
  }

  /** Tên chuyến (mọi event) + người nhận phụ (chỉ event cần). */
  private async loadContext(event: Event): Promise<BookingNotificationContext> {
    const payload = (event.payload ?? {}) as Record<string, unknown>
    const tripTitle =
      typeof payload.tripId === 'string'
        ? (await this.db.trip.findUnique({ where: { id: payload.tripId }, select: { title: true } }))?.title
        : undefined
    return { ...(await this.loadRecipients(event, payload)), tripTitle: tripTitle ?? undefined }
  }

  private async loadRecipients(event: Event, payload: Record<string, unknown>): Promise<BookingNotificationContext> {
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
