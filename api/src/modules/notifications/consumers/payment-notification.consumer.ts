import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import envConfig from '../../../shared/config'
import { PrismaService } from '../../../shared/services/prisma.service'
import { NotificationsService } from '../notifications.service'
import { drainNotificationOutbox, NOTIFICATION_OUTBOX_SOURCES, NotificationOutboxEvent } from './notification-outbox-drain'
import {
  PAYMENT_NOTIFICATION_CONSUMER,
  paymentNotificationEvents,
  paymentNotificationProjection,
  PaymentSucceededContext,
  RefundSucceededContext,
} from './payment-notification.projection'

/** Thông báo trong app từ payment_outbox_events, có receipt theo consumer (payment_notification_receipts). */
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
    if (this.isProcessing || !envConfig.NOTIFICATION_CONSUMER_ENABLED) return
    this.isProcessing = true
    try {
      await this.processPaymentEvents()
    } catch {
      this.logger.error('Payment notification scanner failed; retry on next tick')
    } finally {
      this.isProcessing = false
    }
  }

  processPaymentEvents() {
    return drainNotificationOutbox({
      db: this.db,
      source: NOTIFICATION_OUTBOX_SOURCES.payment,
      consumer: PAYMENT_NOTIFICATION_CONSUMER,
      eventTypes: paymentNotificationEvents,
      deliver: (event) => this.deliver(event),
      logger: this.logger,
    })
  }

  private async deliver(event: NotificationOutboxEvent) {
    const ctx = await this.loadContext(event)
    // Không tìm thấy dữ liệu nguồn (hoặc event không thuộc loại cần báo): ghi receipt hoàn tất.
    if (!ctx) return
    for (const delivery of paymentNotificationProjection(event.eventType, ctx))
      await this.notificationsService.deliverEvent(event.id, delivery.semanticType, {
        ...delivery.data,
        userId: delivery.userId,
      })
  }

  private async loadContext(
    event: NotificationOutboxEvent,
  ): Promise<PaymentSucceededContext | RefundSucceededContext | null> {
    const payload = (event.payload ?? {}) as Record<string, unknown>
    if (event.eventType === 'PAYMENT_SUCCEEDED') {
      if (event.aggregateType !== 'Payment' || typeof payload.paymentId !== 'string') return null
      const payment = await this.db.payment.findUnique({ where: { id: payload.paymentId }, include: { invoice: true } })
      if (!payment?.invoice) return null
      return {
        kind: 'PAYMENT',
        paymentId: payment.id,
        userId: payment.invoice.userId,
        amount: payment.amount.toString(),
        invoiceId: payment.invoiceId,
        invoiceNo: payment.invoice.invoiceNo ?? null,
        paymentGateway: payment.paymentGateway ?? null,
      }
    }
    if (event.eventType === 'REFUND_SUCCEEDED') {
      if (event.aggregateType !== 'Refund') return null
      const refund = await this.db.refund.findUnique({
        where: { id: event.aggregateId },
        select: {
          id: true,
          status: true,
          amount: true,
          purpose: true,
          rentalOrderId: true,
          providerPayload: true,
          bookingCancellation: { select: { bookingId: true } },
          payment: { select: { invoice: { select: { userId: true } } } },
        },
      })
      // Event chỉ phát khi SUCCEEDED; vẫn kiểm lại để không bao giờ báo "đã hoàn" sai.
      if (!refund || refund.status !== 'SUCCEEDED' || !refund.payment?.invoice) return null
      const providerPayload = refund.providerPayload as Prisma.JsonObject | null
      return {
        kind: 'REFUND',
        refundId: refund.id,
        userId: refund.payment.invoice.userId,
        amount: refund.amount.toString(),
        purpose: refund.purpose,
        rentalOrderId: refund.rentalOrderId,
        bookingId: refund.bookingCancellation?.bookingId ?? null,
        simulated: Boolean(providerPayload?.sandboxSimulation),
      }
    }
    return null
  }
}
