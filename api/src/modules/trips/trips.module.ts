import { Module } from '@nestjs/common'
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

@Module({
  controllers: [
    TransportController,
    LeaderPublicTripController,
    TripOptionsController,
    PublicTripController,
    PrivateTripController,
    TripNavigationController,
    PrivateMembershipController,
  ],
  providers: [
    TransportService,
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
