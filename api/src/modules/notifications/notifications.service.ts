import { Injectable } from '@nestjs/common'
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

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

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
      items: items.map((item) => ({
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
      })),
      total,
      page,
      pageSize,
    }
  }

  // Đếm số lượng chưa đọc (để hiển thị badge đỏ)
  async getUnreadCount(userId: string) {
    const count = await this.notificationModel
      .countDocuments({ userId, status: MongoNotificationStatus.UNREAD })
      .exec()
    return { unreadCount: count }
  }

  // Đánh dấu 1 thông báo đã đọc
  async markAsRead(id: string, userId: string) {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, userId },
        { $set: { status: MongoNotificationStatus.READ, readAt: new Date() } },
        { new: true },
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
      .findOneAndUpdate(
        { _id: id, userId },
        { $set: { status: MongoNotificationStatus.ARCHIVED } },
        { new: true },
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
    }
  }

  // Tìm thông báo theo outboxEventId để chống xử lý trùng (Idempotency)
  async findByOutboxEventId(outboxEventId: string) {
    return await this.notificationModel
      .findOne({ 'metadata.outboxEventId': outboxEventId })
      .lean()
      .exec()
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
