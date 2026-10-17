import { z } from 'zod'
import {
  MongoNotificationStatus,
  NotificationType,
  ReferenceType,
} from './schemas/notification.schema'

export const notificationIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'ID thông báo phải là chuỗi ObjectId 24 ký tự hex hợp lệ')

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.nativeEnum(MongoNotificationStatus).optional(),
  type: z.nativeEnum(NotificationType).optional(),
})

export type NotificationQuery = z.infer<typeof notificationQuerySchema>

export const createNotificationSchema = z.object({
  userId: z.string().uuid('User ID phải là UUID hợp lệ'),
  title: z.string().min(1).max(250),
  content: z.string().min(1),
  notificationType: z.nativeEnum(NotificationType),
  referenceType: z.nativeEnum(ReferenceType).optional(),
  referenceId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>
