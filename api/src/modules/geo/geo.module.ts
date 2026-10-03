import { Module } from '@nestjs/common'
import { TripMapStateController } from './presentation/controllers/trip-map-state.controller'
import { GetTripMapStateUseCase } from './application/use-cases/get-trip-map-state.use-case'
import { PrismaTripMapStateAdapter } from './infrastructure/adapters/prisma-trip-map-state.adapter'
import { TripMapStatePort } from './application/ports/trip-map-state.port'

@Module({
  controllers: [TripMapStateController],
  providers: [
    GetTripMapStateUseCase,
    {
      provide: TripMapStatePort,
      useClass: PrismaTripMapStateAdapter,
    },
  ],
  exports: [GetTripMapStateUseCase],
})
export class GeoModule {}
