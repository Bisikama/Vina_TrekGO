import { Module } from '@nestjs/common'
import { BookingPaymentConsumer } from './booking-payment.consumer'
import { BookingsController } from './bookings.controller'

@Module({ controllers: [BookingsController], providers: [BookingPaymentConsumer], exports: [BookingPaymentConsumer] })
export class BookingsModule {}
