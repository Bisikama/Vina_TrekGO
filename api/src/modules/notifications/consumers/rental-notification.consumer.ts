import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Prisma, UserRole, UserStatus } from '@prisma/client'
import envConfig from '../../../shared/config'
import { PrismaService } from '../../../shared/services/prisma.service'
import { SYSTEM_FAULT_CANCELLATION_REASON } from '../../rental/ordering/application/ports/rental-system-fault-cancellation.port'
import { NotificationsService } from '../notifications.service'
import { drainNotificationOutbox, NOTIFICATION_OUTBOX_SOURCES, NotificationOutboxEvent } from './notification-outbox-drain'
import {
  RENTAL_NOTIFICATION_CONSUMER,
  rentalNotificationEvents,
  rentalNotificationProjection,
} from './rental-notification.projection'

/** Thông báo trong app từ rental_outbox_events, có receipt theo consumer (rental_notification_receipts). */
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
    if (this.isProcessing || !envConfig.NOTIFICATION_CONSUMER_ENABLED) return
    this.isProcessing = true
    try {
      await this.processRentalEvents()
    } catch {
      this.logger.error('Rental notification scanner failed; retry on next tick')
    } finally {
      this.isProcessing = false
    }
  }

  processRentalEvents() {
    return drainNotificationOutbox({
      db: this.db,
      source: NOTIFICATION_OUTBOX_SOURCES.rental,
      consumer: RENTAL_NOTIFICATION_CONSUMER,
      eventTypes: rentalNotificationEvents,
      deliver: (event) => this.deliver(event),
      logger: this.logger,
    })
  }

  private async deliver(event: NotificationOutboxEvent) {
    const payload = (event.payload ?? {}) as Record<string, unknown>
    const orderId =
      (typeof payload.orderId === 'string' && payload.orderId) ||
      (typeof payload.rentalOrderId === 'string' && payload.rentalOrderId) ||
      (event.aggregateType === 'RentalOrder' ? event.aggregateId : null)
    if (!orderId) return

    const refundSimulated =
      event.eventType === 'DEPOSIT_REFUND_SUCCEEDED' && typeof payload.refundId === 'string'
        ? await this.isSimulatedRefund(payload.refundId)
        : false
    // Projection trước: phần lớn RENTAL_ACTION_REQUIRED (vận hành nội bộ) không cần báo ai, khỏi tra DB.
    const deliveries = rentalNotificationProjection(event.eventType, payload, {
      orderId,
      refundSimulated,
      shortageAlertHours: envConfig.GRADE_SHORTAGE_ALERT_HOURS,
    })
    if (!deliveries.length) return

    const order = await this.db.rentalOrder.findUnique({ where: { id: orderId }, select: { id: true, userId: true } })
    // Đơn không tồn tại: không có ai để báo, ghi receipt hoàn tất.
    if (!order) return
    const staffIds = deliveries.some((d) => d.audience === 'STAFF') ? await this.activeStaffIds() : []
    // Không có ai nhận thì retry thay vì ghi receipt hoàn tất (mất thông báo vĩnh viễn).
    if (deliveries.some((d) => d.audience === 'STAFF') && !staffIds.length) throw new Error('NO_STAFF_RECIPIENT')
    for (const delivery of deliveries) {
      const recipients = delivery.audience === 'STAFF' ? staffIds : [order.userId]
      for (const userId of recipients)
        await this.notificationsService.deliverEvent(event.id, delivery.semanticType, { ...delivery.data, userId })
    }
  }

  private async isSimulatedRefund(refundId: string) {
    const refund = await this.db.refund.findUnique({ where: { id: refundId }, select: { providerPayload: true } })
    const payload = refund?.providerPayload as Prisma.JsonObject | null | undefined
    return Boolean(payload?.sandboxSimulation)
  }

  private async activeStaffIds() {
    const users = await this.db.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.STAFF_INVENTORY] }, status: UserStatus.ACTIVE },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    return users.map((u) => u.id)
  }
}
