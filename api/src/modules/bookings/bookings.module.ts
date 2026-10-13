import { Module } from '@nestjs/common'
import { BookingPolicyController } from './booking-policy.controller'
import { BookingPolicyService } from './booking-policy.service'
import { BookingPaymentConsumer } from './booking-payment.consumer'
import { BookingsController, BookingRentalContextController } from './bookings.controller'
import { BookingsService } from './bookings.service'
import { BookingDiscoveryController, BookingDiscoveryService } from './booking-discovery.controller'

@Module({
  controllers: [BookingsController, BookingRentalContextController, BookingDiscoveryController, BookingPolicyController],
  providers: [BookingPaymentConsumer, BookingsService, BookingDiscoveryService, BookingPolicyService],
  exports: [BookingPaymentConsumer, BookingsService],
})
export class BookingsModule {}
