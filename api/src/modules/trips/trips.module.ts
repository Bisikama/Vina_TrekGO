import { Module } from '@nestjs/common'
import { PrivateMemberInvitationService } from './infrastructure/adapters/private-member-invitation.service'
import { PrivateMemberInvitationController } from './presentation/controllers/private-member-invitation.controller'
import { PrivateInvitationRequestService } from './infrastructure/adapters/private-invitation-request.service'
import { TripHistoryController } from './presentation/controllers/trip-history.controller'
import { TripHistoryUseCase } from './application/use-cases/trip-history.use-case'
import { TripHistoryPort } from './application/trip-history.port'
import { PrismaTripHistoryAdapter } from './infrastructure/adapters/prisma-trip-history.adapter'
import { TransportController } from './transport/transport.controller'
import { TransportService } from './transport/transport.service'
import { PrivateInviteRateGuard } from './presentation/private-invite-rate.guard'
import { PrivateMembershipController } from './presentation/controllers/private-membership.controller'
import { PrivateMembershipUseCase } from './application/use-cases/private-membership.use-case'
import { PrivateMembershipPort } from './application/private-membership.port'
import { PrismaPrivateMembershipAdapter } from './infrastructure/adapters/prisma-private-membership.adapter'
import { PrivateTripController } from './presentation/controllers/private-trip.controller'
import { PrivateTripUseCase } from './application/use-cases/private-trip.use-case'
import { PrivateTripPort } from './application/private-trip.port'
import { PrismaPrivateTripAdapter } from './infrastructure/adapters/prisma-private-trip.adapter'
import { TRIP_STORE } from './application/trip.types'
import { PublicTripUseCase } from './application/use-cases/public-trip.use-case'
import { PrismaTripAdapter } from './infrastructure/adapters/prisma-trip.adapter'
import {
  LeaderPublicTripController,
  PublicTripController,
  TripOptionsController,
} from './presentation/controllers/public-trip.controller'
import { TripNavigationController } from './presentation/controllers/trip-navigation.controller'
import { GetNavigationContextUseCase } from './application/use-cases/get-navigation-context.use-case'
import { SwitchTrailUseCase } from './application/use-cases/switch-trail.use-case'
import { NavigationContextPort } from './application/port/navigation-context.port'
import { PrismaNavigationContextAdapter } from './infrastructure/adapters/prisma-navigation-context.adapter'
import { TripPricingController } from './pricing/trip-pricing.controller'
import { TripPricingService } from './pricing/trip-pricing.service'

@Module({
  controllers: [
    PrivateMemberInvitationController,
    TripHistoryController,
    TransportController,
    TripPricingController,
    LeaderPublicTripController,
    TripOptionsController,
    PublicTripController,
    PrivateTripController,
    TripNavigationController,
    PrivateMembershipController,
  ],
  providers: [
    PrivateMemberInvitationService,
    PrivateInvitationRequestService,
    TripHistoryUseCase,
    { provide: TripHistoryPort, useClass: PrismaTripHistoryAdapter },
    TransportService,
    TripPricingService,
    PublicTripUseCase,
    PrivateTripUseCase,
    GetNavigationContextUseCase,
    SwitchTrailUseCase,
    { provide: PrivateTripPort, useClass: PrismaPrivateTripAdapter },
    { provide: TRIP_STORE, useClass: PrismaTripAdapter },
    { provide: NavigationContextPort, useClass: PrismaNavigationContextAdapter },
    PrivateMembershipUseCase,
    PrivateInviteRateGuard,
    { provide: PrivateMembershipPort, useClass: PrismaPrivateMembershipAdapter },
  ],
})
export class TripsModule {}
