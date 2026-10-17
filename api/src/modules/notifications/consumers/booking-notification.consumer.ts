import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { EventStatus } from '@prisma/client'
import envConfig from '../../../shared/config'
import { PrismaService } from '../../../shared/services/prisma.service'
import { NotificationsService } from '../notifications.service'
import {
  NotificationType,
  ReferenceType,
} from '../schemas/notification.schema'

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
    if (this.isProcessing || !envConfig.NOTIFICATION_CONSUMER_ENABLED) {
      return
    }

    this.isProcessing = true
    try {
      await this.processBookingEvents()
    } catch (err) {
      this.logger.error('Lỗi khi quét booking_outbox_events:', err)
    } finally {
      this.isProcessing = false
    }
  }

  private async processBookingEvents() {
    const events = await this.db.bookingOutboxEvent.findMany({
      where: {
        status: {
          in: [EventStatus.PENDING, EventStatus.PROCESSED],
        },
        eventType: {
          in: [
            'BOOKING_CONFIRMED',
            'BOOKING_CANCELLED',
            'PRIVATE_TRIP_MEMBER_JOINED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    })

    for (const event of events) {
      try {
        const payload = event.payload as Record<string, any>
        if (!payload || !payload.userId) continue

        // Kiểm tra Idempotency: tránh trùng lặp thông báo
        const existing = await this.notificationsService.findByOutboxEventId(event.id)
        if (existing) continue

        if (event.eventType === 'BOOKING_CONFIRMED') {
          await this.notificationsService.createNotification({
            userId: payload.userId,
            title: 'Đặt chỗ thành công!',
            content: 'Chuyến trekking của bạn đã được xác nhận thành công. Chúc bạn có một hành trình an toàn và đáng nhớ!',
            notificationType: NotificationType.BOOKING_CONFIRMED,
            referenceType: ReferenceType.BOOKING,
            referenceId: payload.bookingId,
            metadata: {
              outboxEventId: event.id,
              tripId: payload.tripId,
              confirmedAt: payload.confirmedAt,
            },
          })
          this.logger.log(`[BookingConsumer] Đã tạo thông báo BOOKING_CONFIRMED cho user ${payload.userId}`)
        } else if (event.eventType === 'BOOKING_CANCELLED') {
          await this.notificationsService.createNotification({
            userId: payload.userId,
            title: 'Hủy đặt chỗ thành công',
            content: 'Chuyến đi của bạn đã được hủy. Mọi thủ tục hoàn cọc/tiền (nếu có) đang được hệ thống xử lý.',
            notificationType: NotificationType.BOOKING_CANCELLED,
            referenceType: ReferenceType.BOOKING,
            referenceId: payload.bookingId,
            metadata: {
              outboxEventId: event.id,
              tripId: payload.tripId,
              cancellationId: payload.cancellationId,
            },
          })
          this.logger.log(`[BookingConsumer] Đã tạo thông báo BOOKING_CANCELLED cho user ${payload.userId}`)
        } else if (event.eventType === 'PRIVATE_TRIP_MEMBER_JOINED') {
          await this.notificationsService.createNotification({
            userId: payload.userId,
            title: 'Gia nhập chuyến đi thành công',
            content: 'Bạn đã tham gia thành công vào chuyến đi riêng (Private Trip).',
            notificationType: NotificationType.BOOKING_CONFIRMED,
            referenceType: ReferenceType.TRIP,
            referenceId: payload.tripId,
            metadata: {
              outboxEventId: event.id,
              tripId: payload.tripId,
              memberRole: payload.memberRole,
            },
          })
          this.logger.log(`[BookingConsumer] Đã tạo thông báo PRIVATE_TRIP_MEMBER_JOINED cho user ${payload.userId}`)
        }
      } catch (err) {
        this.logger.warn(`Lỗi xử lý booking event ${event.id}: ${err.message}`)
      }
    }
  }
}
