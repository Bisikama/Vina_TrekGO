import { Module } from '@nestjs/common'
import { SystemTrailController } from './presentation/controllers/system-trail.controller'
import { GetSystemTrailsUseCase } from './application/use-cases/get-system-trails.use-case'
import { GetSystemTrailDetailUseCase } from './application/use-cases/get-system-trail-detail.use-case'
import { I_SYSTEM_TRAIL_REPOSITORY } from './application/ports/system-trail.port'
import { PrismaSystemTrailAdapter } from './infrastructure/adapters/prisma-system-trail.adapter'

@Module({
  controllers: [SystemTrailController],
  providers: [
    GetSystemTrailsUseCase,
    GetSystemTrailDetailUseCase,
    {
      provide: I_SYSTEM_TRAIL_REPOSITORY,
      useClass: PrismaSystemTrailAdapter,
    },
  ],
  exports: [GetSystemTrailDetailUseCase, I_SYSTEM_TRAIL_REPOSITORY],
})
export class SystemTrailModule {}