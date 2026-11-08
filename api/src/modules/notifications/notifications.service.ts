import { Injectable, Optional } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  Notification,
  NotificationDocument,
  MongoNotificationStatus,
  NotificationType,
} from './schemas/notification.schema'
import { AppError } from '../../shared/errors/app-error'
import { NOTIFICATION_ERROR_CODES } from '../../shared/errors/codes/notification.error-codes'
import { NOTIFICATION_SOCKET_EVENTS, NotificationGateway } from '../../websockets/notification.gateway'

type NotificationRecord = Notification & { _id: { toString(): string } }

/** Dạng trả về chung cho REST và socket. */
function toNotificationView(item: NotificationRecord) {
  return {
    id: item._id.toString(),
    userId: item.userId,
    title: item.title,
    content: item.content,
    notificationType: item.notificationType,
    referenceType: item.referenceType ?? null,
    referenceId: item.referenceId ?? null,
    status: item.status,
    readAt: item.readAt ?? null,
    metadata: item.metadata ?? {},
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

@Injectable()
export class NotificationsService {
  private deliveryIndexReady?: Promise<unknown>
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    // Optional để test tích hợp khởi tạo service không cần socket.
    @Optional() private readonly gateway?: NotificationGateway,
  ) {}

  // Require the additive unique index even when production disables autoIndex.
  async ensureDeliveryIndex() {
    if (!this.deliveryIndexReady) {
      this.deliveryIndexReady = this.notificationModel.collection
        .createIndex(
          { deliveryKey: 1 },
          {
            unique: true,
            partialFilterExpression: { deliveryKey: { $type: 'string' } },
            name: 'notification_delivery_key_unique',
          },
        )
        .catch((error) => {
          this.deliveryIndexReady = undefined
          throw error
        })
    }
    await this.deliveryIndexReady
  }

  async deliverBookingEvent(eventId: string, semanticType: string, data: Partial<Notification> & { userId: string }) {
    return this.deliverEvent(eventId, semanticType, data)
  }

  /**
   * Gửi một thông báo cho một outbox event, an toàn khi gọi lại: khoá `${eventId}:${userId}:${semanticType}` unique.
   * Dùng chung cho consumer booking, rental và payment (id event là uuid nên không trùng giữa các bảng).
   */
  async deliverEvent(eventId: string, semanticType: string, data: Partial<Notification> & { userId: string }) {
    await this.ensureDeliveryIndex()
    // Legacy deliveries lacked semanticType. A recipient's receipt must not suppress another recipient.
    const legacy = await this.notificationModel
      .findOne({
        userId: data.userId,
        'metadata.outboxEventId': eventId,
        $or: [{ 'metadata.semanticType': semanticType }, { 'metadata.semanticType': { $exists: false } }],
      })
      .lean()
      .exec()
    if (legacy) return
    const deliveryKey = `${eventId}:${data.userId}:${semanticType}`
    try {
      const result = await this.notificationModel
        .updateOne(
          { deliveryKey },
          {
            $setOnInsert: {
              ...data,
              deliveryKey,
              metadata: { ...data.metadata, outboxEventId: eventId, semanticType },
            },
          },
          { upsert: true, runValidators: true },
        )
        .exec()
      // Chỉ đẩy realtime khi vừa tạo mới; lần gọi lại (retry/replay) không gửi trùng.
      if (result.upsertedCount === 1 && this.gateway) await this.pushRealtime(deliveryKey)
    } catch (error) {
      if (error?.code !== 11000 || !(await this.notificationModel.exists({ deliveryKey }))) throw error
    }
  }

  /** Lỗi khi đọc/emit không làm event bị retry: thông báo đã lưu, client vẫn thấy qua REST. */
  private async pushRealtime(deliveryKey: string) {
    try {
      const saved = await this.notificationModel.findOne({ deliveryKey }).lean().exec()
      if (saved) this.gateway!.emitToUser(saved.userId, NOTIFICATION_SOCKET_EVENTS.NEW, toNotificationView(saved))
    } catch {
      // bỏ qua
    }
  }

  // Lấy danh sách phân trang cho User
  async getUserNotifications(
    userId: string,
    page = 1,
    pageSize = 10,
    status?: MongoNotificationStatus,
    type?: NotificationType,
  ) {
    const filter: Record<string, any> = { userId }
    if (status) {
      filter.status = status
    } else {
      filter.status = { $ne: MongoNotificationStatus.ARCHIVED } // Mặc định không hiện thông báo đã lưu trữ
    }

    if (type) {
      filter.notificationType = type
    }

    const [items, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ])

    return {
      items: items.map(toNotificationView),
      total,
      page,
      pageSize,
    }
  }

  // Đếm số lượng chưa đọc (để hiển thị badge đỏ)
  async getUnreadCount(userId: string) {
    const count = await this.notificationModel.countDocuments({ userId, status: MongoNotificationStatus.UNREAD }).exec()
    return { unreadCount: count }
  }

  // Đánh dấu 1 thông báo đã đọc
  async markAsRead(id: string, userId: string) {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, userId },
        { $set: { status: MongoNotificationStatus.READ, readAt: new Date() } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec()

    if (!updated) {
      throw new AppError({
        code: NOTIFICATION_ERROR_CODES.NOTIFICATION_NOT_FOUND,
        message: 'Notification not found or access denied',
      })
    }

    return {
      id: updated._id.toString(),
      status: updated.status,
      readAt: updated.readAt,
    }
  }

  // Đánh dấu tất cả đã đọc
  async markAllAsRead(userId: string) {
    const res = await this.notificationModel
      .updateMany(
        { userId, status: MongoNotificationStatus.UNREAD },
        { $set: { status: MongoNotificationStatus.READ, readAt: new Date() } },
      )
      .exec()
    return { updatedCount: res.modifiedCount }
  }

  // Lưu trữ 1 thông báo
  async archive(id: string, userId: string) {
    const updated = await this.notificationModel
      .findOneAndUpdate({ _id: id, userId }, { $set: { status: MongoNotificationStatus.ARCHIVED } }, { returnDocument: 'after' })
      .lean()
      .exec()

    if (!updated) {
      throw new AppError({
        code: NOTIFICATION_ERROR_CODES.NOTIFICATION_NOT_FOUND,
        message: 'Notification not found or access denied',
      })
    }

    return {
      id: updated._id.toString(),
      status: updated.status,
    }
  }

  // Tìm thông báo theo outboxEventId để chống xử lý trùng (Idempotency)
  async findByOutboxEventId(outboxEventId: string) {
    return await this.notificationModel.findOne({ 'metadata.outboxEventId': outboxEventId }).lean().exec()
  }

  // Tạo thông báo mới (dùng khi Consumer đọc outbox event từ Booking/Payment/GPS)
  async createNotification(data: Partial<Notification>) {
    const doc = new this.notificationModel(data)
    const saved = await doc.save()
    const obj = saved.toObject()
    return {
      ...obj,
      id: saved._id.toString(),
    }
  }
}
