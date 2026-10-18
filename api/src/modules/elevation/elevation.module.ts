import { Module } from '@nestjs/common'
import { ProcessTrailElevationUseCase } from './application/use-cases/process-trail-elevation.use-case'
import { I_ELEVATION_PROVIDER } from './application/ports/elevation-provider.port'
import { AwsTerrariumElevationAdapter } from './infrastructure/adapters/aws-terrarium.adapter'
import { ElevationController } from './presentation/controllers/elevation.controller'

@Module({
  controllers: [ElevationController],
  providers: [
    ProcessTrailElevationUseCase,
    AwsTerrariumElevationAdapter,
    {
      provide: I_ELEVATION_PROVIDER,
      useClass: AwsTerrariumElevationAdapter,
    },
  ],
  exports: [ProcessTrailElevationUseCase, I_ELEVATION_PROVIDER, AwsTerrariumElevationAdapter],
})
export class ElevationModule {}
