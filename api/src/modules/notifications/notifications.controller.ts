import { Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Auth } from '../../shared/decorators/auth.decorator'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe'
import { NotificationsService } from './notifications.service'
import {
  notificationIdSchema,
  notificationQuerySchema,
  type NotificationQuery,
} from './notification.dto'
import {
  MongoNotificationStatus,
  NotificationType,
} from './schemas/notification.schema'

@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@Auth([AuthType.Bearer])
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo phân trang của người dùng' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Số trang (mặc định: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Số lượng item mỗi trang (mặc định: 10)' })
  @ApiQuery({ name: 'status', required: false, enum: MongoNotificationStatus, description: 'Lọc theo trạng thái đọc' })
  @ApiQuery({ name: 'type', required: false, enum: NotificationType, description: 'Lọc theo loại nghiệp vụ' })
  list(
    @ActiveUser('id') userId: string,
    @Query(new ZodValidationPipe(notificationQuerySchema)) query: NotificationQuery,
  ) {
    return this.notificationsService.getUserNotifications(
      userId,
      query.page,
      query.pageSize,
      query.status,
      query.type,
    )
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Lấy số lượng thông báo chưa đọc' })
  unreadCount(@ActiveUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId)
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo là đã đọc' })
  markAllAsRead(@ActiveUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId)
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Đánh dấu một thông báo là đã đọc' })
  markAsRead(
    @Param('id', new ZodValidationPipe(notificationIdSchema)) id: string,
    @ActiveUser('id') userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId)
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Lưu trữ một thông báo' })
  archive(
    @Param('id', new ZodValidationPipe(notificationIdSchema)) id: string,
    @ActiveUser('id') userId: string,
  ) {
    return this.notificationsService.archive(id, userId)
  }
}
