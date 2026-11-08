import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { WebsocketModule } from '../../websockets/websocket.module'
import { Notification, NotificationSchema } from './schemas/notification.schema'

import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { BookingNotificationConsumer } from './consumers/booking-notification.consumer'
import { PaymentNotificationConsumer } from './consumers/payment-notification.consumer'
import { RentalNotificationConsumer } from './consumers/rental-notification.consumer'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    WebsocketModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    BookingNotificationConsumer,
    PaymentNotificationConsumer,
    RentalNotificationConsumer,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
