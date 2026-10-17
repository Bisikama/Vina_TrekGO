import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose'

export type NotificationDocument = HydratedDocument<Notification>

export enum MongoNotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

export enum NotificationType {
  // 1. Payment & Refund
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_REFUND = 'PAYMENT_REFUND',

  // 2. Booking & Trips
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  BOOKING_HOLD_EXPIRED = 'BOOKING_HOLD_EXPIRED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  PRIVATE_TRIP_INVITE = 'PRIVATE_TRIP_INVITE',
  TRIP_UPCOMING_REMINDER = 'TRIP_UPCOMING_REMINDER',

  // 3. Rental (Thuê đồ)
  RENTAL_ORDER_CONFIRMED = 'RENTAL_ORDER_CONFIRMED',
  RENTAL_ORDER_CANCELLED = 'RENTAL_ORDER_CANCELLED',
  RENTAL_READY_FOR_PICKUP = 'RENTAL_READY_FOR_PICKUP',
  RENTAL_ORDER_REMINDER = 'RENTAL_ORDER_REMINDER',
  RENTAL_ORDER_RETURNED = 'RENTAL_ORDER_RETURNED',
  RENTAL_ORDER_RETURNED_LATE = 'RENTAL_ORDER_RETURNED_LATE',
  RENTAL_DAMAGE_REPORTED = 'RENTAL_DAMAGE_REPORTED',
  RENTAL_DEPOSIT_REFUNDED = 'RENTAL_DEPOSIT_REFUNDED',

  // 4. GPS & Safety (An toàn)
  TRIP_ALERT = 'TRIP_ALERT',
  DEVIATION_WARNING = 'DEVIATION_WARNING',

  // 5. System & Gamification
  RANK_UPGRADE = 'RANK_UPGRADE',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
}

export enum ReferenceType {
  BOOKING = 'BOOKING',
  TRIP = 'TRIP',
  RENTAL_ORDER = 'RENTAL_ORDER',
  PAYMENT = 'PAYMENT',
  SYSTEM = 'SYSTEM',
}

@Schema({
  collection: 'notifications',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class Notification {
  @Prop({ required: true, type: String })
  userId: string

  @Prop({ required: true, maxlength: 250, type: String })
  title: string

  @Prop({ required: true, type: String })
  content: string

  @Prop({ required: true, enum: Object.values(NotificationType), type: String })
  notificationType: NotificationType

  // referenceType & referenceId là OPTIONAL (cho phép null khi là thông báo hệ thống)
  @Prop({ required: false, enum: Object.values(ReferenceType), type: String, default: null })
  referenceType?: ReferenceType

  @Prop({ required: false, type: String, default: null })
  referenceId?: string

  @Prop({
    type: String,
    enum: Object.values(MongoNotificationStatus),
    default: MongoNotificationStatus.UNREAD,
  })
  status: MongoNotificationStatus

  @Prop({ type: Date, default: null })
  readAt?: Date

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata?: Record<string, any>

  createdAt: Date
  updatedAt: Date
}

export const NotificationSchema = SchemaFactory.createForClass(Notification)

// Index phức hợp để tối ưu việc query danh sách theo user, trạng thái đọc và thời gian
NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 })

// Index tìm kiếm theo đối tượng nguồn (chỉ index khi các trường này tồn tại)
NotificationSchema.index({ referenceType: 1, referenceId: 1 })

// Index idempotency để worker kiểm tra sự kiện đã xử lý hay chưa
NotificationSchema.index({ 'metadata.outboxEventId': 1 })

