import { Module } from '@nestjs/common'
import { DestinationController } from './presentation/controllers/destination.controller'
import { GetDestinationsUseCase } from './application/use-cases/get-destinations.use-case'
import { GetDestinationDetailUseCase } from './application/use-cases/get-destination-detail.use-case'
import { CreateDestinationUseCase } from './application/use-cases/create-destination.use-case'
import { UpdateDestinationUseCase } from './application/use-cases/update-destination.use-case'
import { DeleteDestinationUseCase } from './application/use-cases/delete-destination.use-case'
import { DestinationPort } from './application/ports/destination.port'
import { PrismaDestinationAdapter } from './infrastructure/adapters/prisma-destination.adapter'

@Module({
  controllers: [DestinationController],
  providers: [
    GetDestinationsUseCase,
    GetDestinationDetailUseCase,
    CreateDestinationUseCase,
    UpdateDestinationUseCase,
    DeleteDestinationUseCase,
    {
      provide: DestinationPort,
      useClass: PrismaDestinationAdapter,
    },
  ],
  exports: [
    GetDestinationsUseCase,
    GetDestinationDetailUseCase,
    CreateDestinationUseCase,
    UpdateDestinationUseCase,
    DeleteDestinationUseCase,
    DestinationPort,
  ],
})
export class DestinationModule {}
