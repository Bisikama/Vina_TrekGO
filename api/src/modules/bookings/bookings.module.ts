import { Module } from '@nestjs/common'
import { BookingPaymentConsumer } from './booking-payment.consumer'
import { BookingsController, BookingRentalContextController } from './bookings.controller'
import { BookingsService } from './bookings.service'
import { BookingDiscoveryController, BookingDiscoveryService } from './booking-discovery.controller'

@Module({
  controllers: [BookingsController, BookingRentalContextController, BookingDiscoveryController],
  providers: [BookingPaymentConsumer, BookingsService, BookingDiscoveryService],
  exports: [BookingPaymentConsumer, BookingsService],
})
export class BookingsModule {}
