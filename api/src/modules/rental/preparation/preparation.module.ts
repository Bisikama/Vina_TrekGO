import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module';
import { PREPARATION_TASK_PORT, WAREHOUSE_TASK_PORT } from './application/ports/preparation-task.port';
import { PrismaPreparationTaskAdapter } from './infrastructure/adapters/prisma-preparation-task.adapter';
import { ClaimPreparationTaskUseCase } from './application/use-cases/claim-preparation-task.use-case';
import { GetPreparationTaskUseCase } from './application/use-cases/get-preparation-task.use-case';
import { ListPickCandidatesUseCase } from './application/use-cases/list-pick-candidates.use-case';
import { ListPreparationTasksUseCase } from './application/use-cases/list-preparation-tasks.use-case';
import { ListReplacementCandidatesUseCase } from './application/use-cases/list-replacement-candidates.use-case';
import { MarkPreparationReadyUseCase } from './application/use-cases/mark-preparation-ready.use-case';
import { PackPreparationPackageUseCase } from './application/use-cases/pack-preparation-package.use-case';
import { PickPreparationUnitsUseCase } from './application/use-cases/pick-preparation-units.use-case';
import { ReplacePreparationUnitUseCase } from './application/use-cases/replace-preparation-unit.use-case';
import { RequestPreparationTransferUseCase } from './application/use-cases/request-preparation-transfer.use-case';
import { SavePreHandoverConditionUseCase } from './application/use-cases/save-pre-handover-condition.use-case';
import { PreparationTaskController } from './presentation/controllers/preparation-task.controller';

const USE_CASES = [
  ListPreparationTasksUseCase,
  GetPreparationTaskUseCase,
  ClaimPreparationTaskUseCase,
  ListPickCandidatesUseCase,
  PickPreparationUnitsUseCase,
  SavePreHandoverConditionUseCase,
  ListReplacementCandidatesUseCase,
  ReplacePreparationUnitUseCase,
  PackPreparationPackageUseCase,
  MarkPreparationReadyUseCase,
  RequestPreparationTransferUseCase,
];

@Module({
  imports: [SharedModule],
  controllers: [PreparationTaskController],
  providers: [
    ...USE_CASES,
    {
      provide: PREPARATION_TASK_PORT,
      useClass: PrismaPreparationTaskAdapter,
    },
    {
      provide: WAREHOUSE_TASK_PORT,
      useExisting: PREPARATION_TASK_PORT,
    },
  ],
  exports: [...USE_CASES, PREPARATION_TASK_PORT, WAREHOUSE_TASK_PORT],
})
export class PreparationModule {}
