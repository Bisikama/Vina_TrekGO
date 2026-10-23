import { Module } from '@nestjs/common'
import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'
import { ParticipantClaimService } from './participant-claim.service'
import { BookingPolicyController } from './booking-policy.controller'
import { BookingPolicyService } from './booking-policy.service'
import { BookingPaymentConsumer } from './booking-payment.consumer'
import { BookingsController, BookingRentalContextController } from './bookings.controller'
import { BookingsService } from './bookings.service'
import { BookingDiscoveryController, BookingDiscoveryService } from './booking-discovery.controller'

@Module({
  controllers: [
    TicketsController,
    BookingsController,
    BookingRentalContextController,
    BookingDiscoveryController,
    BookingPolicyController,
  ],
  providers: [
    ParticipantClaimService,
    TicketsService,
    BookingPaymentConsumer,
    BookingsService,
    BookingDiscoveryService,
    BookingPolicyService,
  ],
  exports: [BookingPaymentConsumer, BookingsService],
})
export class BookingsModule {}
