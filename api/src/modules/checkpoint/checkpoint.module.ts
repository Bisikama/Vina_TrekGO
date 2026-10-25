import { Module } from '@nestjs/common'
import { CheckpointGpsArrivalPort } from './application/ports/checkpoint-gps-arrival.port'
import { PrismaCheckpointGpsArrivalAdapter } from './infrastructure/adapters/prisma-checkpoint-gps-arrival.adapter'
import { CheckpointController } from './presentation/controllers/checkpoint.controller'
import { GetCheckpointsUseCase } from './application/use-cases/get-checkpoints.use-case'
import { GetCheckpointDetailUseCase } from './application/use-cases/get-checkpoint-detail.use-case'
import { CreateCheckpointUseCase } from './application/use-cases/create-checkpoint.use-case'
import { UpdateCheckpointUseCase } from './application/use-cases/update-checkpoint.use-case'
import { DeleteCheckpointUseCase } from './application/use-cases/delete-checkpoint.use-case'
import { CheckpointPort } from './application/ports/checkpoint.port'
import { PrismaCheckpointAdapter } from './infrastructure/adapters/prisma-checkpoint.adapter'

@Module({
  controllers: [CheckpointController],
  providers: [
    { provide: CheckpointGpsArrivalPort, useClass: PrismaCheckpointGpsArrivalAdapter },
    GetCheckpointsUseCase,
    GetCheckpointDetailUseCase,
    CreateCheckpointUseCase,
    UpdateCheckpointUseCase,
    DeleteCheckpointUseCase,
    {
      provide: CheckpointPort,
      useClass: PrismaCheckpointAdapter,
    },
  ],
  exports: [
    CheckpointGpsArrivalPort,
    GetCheckpointsUseCase,
    GetCheckpointDetailUseCase,
    CreateCheckpointUseCase,
    UpdateCheckpointUseCase,
    DeleteCheckpointUseCase,
    CheckpointPort,
  ],
})
export class CheckpointModule {}
