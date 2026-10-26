import { PublicInvitationsController } from './public-invitations.controller'
import { PublicInvitationsService, PublicInvitationRequestService } from './public-invitations.service'
import { Module } from '@nestjs/common'
import { BookingParticipationContextService } from './booking-participation-context.service'
import { InvitationInboxController } from './invitation-inbox.controller'
import { InvitationInboxService } from './invitation-inbox.service'
import { TicketsController } from './tickets.controller'
import { TicketsService } from './tickets.service'
import { ParticipantClaimService } from './participant-claim.service'
import { BookingPolicyController } from './booking-policy.controller'
import { BookingPolicyService } from './booking-policy.service'
import { BookingPaymentConsumer } from './booking-payment.consumer'
import { BookingsController, BookingRentalContextController } from './bookings.controller'
import { BookingsService } from './bookings.service'
import { BookingDiscoveryController, BookingDiscoveryService } from './booking-discovery.controller'
import { LeaderCheckinController } from './leader-checkin.controller'
import { LeaderCheckinService } from './leader-checkin.service'

@Module({
  controllers: [
    InvitationInboxController,
    PublicInvitationsController,
    TicketsController,
    BookingsController,
    BookingRentalContextController,
    BookingDiscoveryController,
    BookingPolicyController,
    LeaderCheckinController,
  ],
  providers: [
    BookingParticipationContextService,
    InvitationInboxService,
    PublicInvitationsService,
    PublicInvitationRequestService,
    ParticipantClaimService,
    TicketsService,
    BookingPaymentConsumer,
    BookingsService,
    BookingDiscoveryService,
    BookingPolicyService,
    LeaderCheckinService,
  ],
  exports: [BookingPaymentConsumer, BookingsService, LeaderCheckinService, BookingParticipationContextService],
})
export class BookingsModule {}
