import { Module } from '@nestjs/common'
import { NotificationGateway } from './notification.gateway'
import { PaymentGateway } from './payment.gateway'

@Module({
  providers: [NotificationGateway, PaymentGateway],
})
export class WebsocketModule {}
