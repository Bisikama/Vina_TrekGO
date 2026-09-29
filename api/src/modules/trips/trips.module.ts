import { Module } from '@nestjs/common'
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

@Module({
  controllers: [
    LeaderPublicTripController,
    TripOptionsController,
    PublicTripController,
    PrivateTripController,
    PrivateMembershipController,
  ],
  providers: [
    PublicTripUseCase,
    PrivateTripUseCase,
    PrivateMembershipUseCase,
    PrivateInviteRateGuard,
    { provide: PrivateMembershipPort, useClass: PrismaPrivateMembershipAdapter },
    { provide: PrivateTripPort, useClass: PrismaPrivateTripAdapter },
    { provide: TRIP_STORE, useClass: PrismaTripAdapter },
  ],
})
export class TripsModule {}
