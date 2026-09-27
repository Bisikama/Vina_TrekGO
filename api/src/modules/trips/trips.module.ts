import { Module } from '@nestjs/common'
import { TRIP_STORE } from './application/trip.types'
import { PublicTripUseCase } from './application/use-cases/public-trip.use-case'
import { PrismaTripAdapter } from './infrastructure/adapters/prisma-trip.adapter'
import {
  LeaderPublicTripController,
  PublicTripController,
  TripOptionsController,
} from './presentation/controllers/public-trip.controller'

@Module({
  controllers: [LeaderPublicTripController, TripOptionsController, PublicTripController],
  providers: [PublicTripUseCase, { provide: TRIP_STORE, useClass: PrismaTripAdapter }],
})
export class TripsModule {}
