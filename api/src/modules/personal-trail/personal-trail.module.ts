import { Module } from '@nestjs/common'
import { ElevationModule } from '../elevation/elevation.module'
import { TrailRecordingController } from './presentation/controllers/trail-recording.controller'
import { PersonalTrailController } from './presentation/controllers/personal-trail.controller'
import { TrailRecordingUseCase } from './application/use-cases/trail-recording.use-case'
import { PersonalTrailUseCase } from './application/use-cases/personal-trail.use-case'
import { I_PERSONAL_TRAIL_REPOSITORY } from './application/ports/personal-trail.port'
import { PrismaPersonalTrailAdapter } from './infrastructure/adapters/prisma-personal-trail.adapter'

@Module({
  imports: [ElevationModule],
  controllers: [TrailRecordingController, PersonalTrailController],
  providers: [
    TrailRecordingUseCase,
    PersonalTrailUseCase,
    {
      provide: I_PERSONAL_TRAIL_REPOSITORY,
      useClass: PrismaPersonalTrailAdapter,
    },
  ],
  exports: [TrailRecordingUseCase, PersonalTrailUseCase, I_PERSONAL_TRAIL_REPOSITORY],
})
export class PersonalTrailModule {}
