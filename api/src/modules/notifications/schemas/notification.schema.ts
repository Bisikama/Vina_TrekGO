import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose'

export type NotificationDocument = HydratedDocument<Notification>

// Enum ở file thuần (không phụ thuộc @nestjs/mongoose) để projection và unit test dùng được.
export { MongoNotificationStatus, NotificationType, ReferenceType } from './notification.enums'
import { MongoNotificationStatus, NotificationType, ReferenceType } from './notification.enums'

@Schema({
  collection: 'notifications',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
})
export class Notification {
  @Prop({ type: String, required: false })
  deliveryKey?: string
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
NotificationSchema.index(
  { deliveryKey: 1 },
  {
    unique: true,
    partialFilterExpression: { deliveryKey: { $type: 'string' } },
    name: 'notification_delivery_key_unique',
  },
)
