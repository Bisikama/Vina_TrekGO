import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { EventStatus } from '@prisma/client'
import envConfig from '../../../shared/config'
import { PrismaService } from '../../../shared/services/prisma.service'
import { SYSTEM_FAULT_CANCELLATION_REASON } from '../../rental/ordering/application/ports/rental-system-fault-cancellation.port'
import { NotificationsService } from '../notifications.service'
import {
  NotificationType,
  ReferenceType,
} from '../schemas/notification.schema'

@Injectable()
export class RentalNotificationConsumer {
  private readonly logger = new Logger(RentalNotificationConsumer.name)
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
      await this.processRentalEvents()
    } catch (err) {
      this.logger.error('Lỗi khi quét rental_outbox_events:', err)
    } finally {
      this.isProcessing = false
    }
  }

  private async processRentalEvents() {
    const events = await this.db.rentalOutboxEvent.findMany({
      where: {
        status: {
          in: [EventStatus.PENDING, EventStatus.PROCESSED],
        },
        OR: [
          {
            eventType: {
              in: [
                'RENTAL_PAID',
                'RENTAL_ORDER_CONFIRMED',
                'DEPOSIT_REFUND_SUCCEEDED',
                'DEPOSIT_RETAINED',
              ],
            },
          },
          // Chỉ báo khách khi ADMIN huỷ do lỗi TrekGo; các luồng huỷ khác giữ nguyên hành vi.
          {
            eventType: 'RENTAL_ORDER_CANCELLED',
            payload: { path: ['reason'], equals: SYSTEM_FAULT_CANCELLATION_REASON },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    })

    for (const event of events) {
      try {
        const payload = event.payload as Record<string, any>
        if (!payload || !payload.orderId) continue

        // Kiểm tra Idempotency
        const existing = await this.notificationsService.findByOutboxEventId(event.id)
        if (existing) continue

        // Tra cứu đơn thuê để lấy thông tin userId
        const rentalOrder = await this.db.rentalOrder.findUnique({
          where: { id: payload.orderId },
        })

        if (!rentalOrder) continue

        const userId = rentalOrder.userId

        if (event.eventType === 'RENTAL_PAID' || event.eventType === 'RENTAL_ORDER_CONFIRMED') {
          await this.notificationsService.createNotification({
            userId,
            title: 'Xác nhận đơn thuê thiết bị',
            content: `Đơn thuê thiết bị #${rentalOrder.id.slice(0, 8)} đã được thanh toán thành công và đang được chuẩn bị.`,
            notificationType: NotificationType.RENTAL_ORDER_CONFIRMED,
            referenceType: ReferenceType.RENTAL_ORDER,
            referenceId: rentalOrder.id,
            metadata: {
              outboxEventId: event.id,
              orderId: rentalOrder.id,
              paymentId: payload.paymentId,
            },
          })
          this.logger.log(`[RentalConsumer] Đã tạo thông báo RENTAL_ORDER_CONFIRMED cho user ${userId}`)
        } else if (event.eventType === 'DEPOSIT_REFUND_SUCCEEDED') {
          await this.notificationsService.createNotification({
            userId,
            title: 'Hoàn tiền cọc thiết bị',
            content: `Tiền đặt cọc cho đơn thuê #${rentalOrder.id.slice(0, 8)} đã được hoàn về tài khoản của bạn thành công.`,
            notificationType: NotificationType.RENTAL_DEPOSIT_REFUNDED,
            referenceType: ReferenceType.RENTAL_ORDER,
            referenceId: rentalOrder.id,
            metadata: {
              outboxEventId: event.id,
              orderId: rentalOrder.id,
              refundId: payload.refundId,
            },
          })
          this.logger.log(`[RentalConsumer] Đã tạo thông báo DEPOSIT_REFUND_SUCCEEDED cho user ${userId}`)
        } else if (event.eventType === 'DEPOSIT_RETAINED') {
          await this.notificationsService.createNotification({
            userId,
            title: 'Thông báo xử lý tiền cọc',
            content: `Đơn thuê #${rentalOrder.id.slice(0, 8)} có khoản cọc được khấu trừ/giữ lại theo biên bản kiểm tra thiết bị.`,
            notificationType: NotificationType.RENTAL_DAMAGE_REPORTED,
            referenceType: ReferenceType.RENTAL_ORDER,
            referenceId: rentalOrder.id,
            metadata: {
              outboxEventId: event.id,
              orderId: rentalOrder.id,
              itemId: payload.itemId,
            },
          })
          this.logger.log(`[RentalConsumer] Đã tạo thông báo DEPOSIT_RETAINED cho user ${userId}`)
        } else if (
          event.eventType === 'RENTAL_ORDER_CANCELLED' &&
          payload.reason === SYSTEM_FAULT_CANCELLATION_REASON
        ) {
          await this.notificationsService.createNotification({
            userId,
            title: 'Đơn thuê thiết bị đã bị huỷ',
            content: `Rất tiếc, TrekGo không thể chuẩn bị đủ thiết bị cho đơn thuê #${rentalOrder.id.slice(0, 8)} nên đã huỷ đơn. Toàn bộ tiền thuê và tiền cọc sẽ được hoàn về tài khoản thanh toán của bạn.`,
            notificationType: NotificationType.RENTAL_ORDER_CANCELLED,
            referenceType: ReferenceType.RENTAL_ORDER,
            referenceId: rentalOrder.id,
            metadata: {
              outboxEventId: event.id,
              orderId: rentalOrder.id,
              refundId: payload.refundRef,
              reasonCode: payload.reasonCode,
            },
          })
          this.logger.log(`[RentalConsumer] Đã tạo thông báo RENTAL_ORDER_CANCELLED (system fault) cho user ${userId}`)
        }
      } catch (err) {
        this.logger.warn(`Lỗi xử lý rental event ${event.id}: ${err.message}`)
      }
    }
  }
}
