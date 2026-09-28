import { Module } from '@nestjs/common'
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
  controllers: [LeaderPublicTripController, TripOptionsController, PublicTripController, PrivateTripController],
  providers: [PublicTripUseCase, PrivateTripUseCase, { provide: PrivateTripPort, useClass: PrismaPrivateTripAdapter }, { provide: TRIP_STORE, useClass: PrismaTripAdapter }],
})
export class TripsModule {}
