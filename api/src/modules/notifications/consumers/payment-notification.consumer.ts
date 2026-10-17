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
export class PaymentNotificationConsumer {
  private readonly logger = new Logger(PaymentNotificationConsumer.name)
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
      await this.processPaymentEvents()
    } catch (err) {
      this.logger.error('Lỗi khi quét payment_outbox_events:', err)
    } finally {
      this.isProcessing = false
    }
  }

  private async processPaymentEvents() {
    const events = await this.db.paymentOutboxEvent.findMany({
      where: {
        status: {
          in: [EventStatus.PENDING, EventStatus.PROCESSED],
        },
        eventType: 'PAYMENT_SUCCEEDED',
        aggregateType: 'Payment',
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    })

    for (const event of events) {
      try {
        const payload = event.payload as Record<string, any>
        if (!payload || !payload.paymentId) continue

        // Kiểm tra Idempotency
        const existing = await this.notificationsService.findByOutboxEventId(event.id)
        if (existing) continue

        // Lấy thông tin thanh toán và hóa đơn để tìm userId nhận thông báo
        const payment = await this.db.payment.findUnique({
          where: { id: payload.paymentId },
          include: { invoice: true },
        })

        if (!payment || !payment.invoice) continue

        const userId = payment.invoice.userId
        const amountFormatted = new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
        }).format(Number(payment.amount))

        await this.notificationsService.createNotification({
          userId,
          title: 'Giao dịch thanh toán thành công',
          content: `Bạn đã thanh toán thành công số tiền ${amountFormatted} cho hóa đơn ${payment.invoice.invoiceNo || ''}.`,
          notificationType: NotificationType.PAYMENT_SUCCESS,
          referenceType: ReferenceType.PAYMENT,
          referenceId: payment.id,
          metadata: {
            outboxEventId: event.id,
            invoiceId: payment.invoiceId,
            paymentGateway: payment.paymentGateway,
            amount: payment.amount.toString(),
          },
        })
        this.logger.log(`[PaymentConsumer] Đã tạo thông báo PAYMENT_SUCCESS cho user ${userId}`)
      } catch (err) {
        this.logger.warn(`Lỗi xử lý payment event ${event.id}: ${err.message}`)
      }
    }
  }
}
