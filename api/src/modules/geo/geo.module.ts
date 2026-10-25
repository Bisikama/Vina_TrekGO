import { Module } from '@nestjs/common'
import { CheckpointModule } from '../checkpoint/checkpoint.module'
import { GpsAccessService } from './application/gps-access.service'
import { GpsProjectionService } from './application/gps-projection.service'
import { GpsTrackService } from './application/gps-track.service'
import { TripGpsGateway } from './presentation/gateways/trip-gps.gateway'
import { TripGpsController } from './presentation/controllers/trip-gps.controller'
import { TripGpsRecordingService } from './infrastructure/adapters/trip-gps-recording.service'
import { TripMapStateController } from './presentation/controllers/trip-map-state.controller'
import { GetTripMapStateUseCase } from './application/use-cases/get-trip-map-state.use-case'
import { PrismaTripMapStateAdapter } from './infrastructure/adapters/prisma-trip-map-state.adapter'
import { TripMapStatePort } from './application/ports/trip-map-state.port'

@Module({
  imports: [CheckpointModule],
  controllers: [TripMapStateController, TripGpsController],
  providers: [
    GpsAccessService,
    GpsProjectionService,
    GpsTrackService,
    TripGpsGateway,
    TripGpsRecordingService,
    GetTripMapStateUseCase,
    {
      provide: TripMapStatePort,
      useClass: PrismaTripMapStateAdapter,
    },
  ],
  exports: [GetTripMapStateUseCase, TripGpsRecordingService],
})
export class GeoModule {}
