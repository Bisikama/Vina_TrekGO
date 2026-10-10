import { Module } from '@nestjs/common'
import { SystemTrailController } from './presentation/controllers/system-trail.controller'
import { GetSystemTrailsUseCase } from './application/use-cases/get-system-trails.use-case'
import { GetSystemTrailDetailUseCase } from './application/use-cases/get-system-trail-detail.use-case'
import { CreateSystemTrailUseCase } from './application/use-cases/create-system-trail.use-case'
import { UpdateSystemTrailUseCase } from './application/use-cases/update-system-trail.use-case'
import { DeleteSystemTrailUseCase } from './application/use-cases/delete-system-trail.use-case'
import { I_SYSTEM_TRAIL_REPOSITORY } from './application/ports/system-trail.port'
import { PrismaSystemTrailAdapter } from './infrastructure/adapters/prisma-system-trail.adapter'

@Module({
  controllers: [SystemTrailController],
  providers: [
    GetSystemTrailsUseCase,
    GetSystemTrailDetailUseCase,
    CreateSystemTrailUseCase,
    UpdateSystemTrailUseCase,
    DeleteSystemTrailUseCase,
    {
      provide: I_SYSTEM_TRAIL_REPOSITORY,
      useClass: PrismaSystemTrailAdapter,
    },
  ],
  exports: [
    GetSystemTrailsUseCase,
    GetSystemTrailDetailUseCase,
    CreateSystemTrailUseCase,
    UpdateSystemTrailUseCase,
    DeleteSystemTrailUseCase,
    I_SYSTEM_TRAIL_REPOSITORY,
  ],
})
export class SystemTrailModule {}
