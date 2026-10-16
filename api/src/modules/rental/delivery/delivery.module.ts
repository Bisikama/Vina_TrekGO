import { Module } from '@nestjs/common';
import { SharedModule } from 'src/shared/shared.module';
import { LOGISTICS_PORT } from './application/ports/delivery.port';
import { AssignRentalTaskUseCase } from './application/use-cases/assign-rental-task.use-case';
import { ClaimDeliveryTaskUseCase } from './application/use-cases/claim-delivery-task.use-case';
import { CommitRentalHandoverUseCase } from './application/use-cases/commit-rental-handover.use-case';
import { GetDeliveryTaskUseCase } from './application/use-cases/get-delivery-task.use-case';
import { GetRentalHandoverPreviewUseCase } from './application/use-cases/get-rental-handover-preview.use-case';
import { GetRentalPickupCodeUseCase } from './application/use-cases/get-rental-pickup-code.use-case';
import { ListAdminRentalTasksUseCase } from './application/use-cases/list-admin-rental-tasks.use-case';
import { ListDeliveryTasksUseCase } from './application/use-cases/list-delivery-tasks.use-case';
import { ListRentalAssigneesUseCase } from './application/use-cases/list-rental-assignees.use-case';
import { MarkRentalNoShowUseCase } from './application/use-cases/mark-rental-no-show.use-case';
import { ReceivePackageUseCase } from './application/use-cases/receive-package.use-case';
import { VerifyRentalRecipientUseCase } from './application/use-cases/verify-rental-recipient.use-case';
import { PrismaDeliveryAdapter } from './infrastructure/adapters/prisma-delivery.adapter';
import { DeliveryTaskController } from './presentation/controllers/delivery-task.controller';
import { RentalHandoverController } from './presentation/controllers/rental-handover.controller';
import { RentalTaskAdminController } from './presentation/controllers/rental-task-admin.controller';

@Module({
  imports: [SharedModule],
  controllers: [DeliveryTaskController, RentalHandoverController, RentalTaskAdminController],
  providers: [
    ListDeliveryTasksUseCase,
    GetDeliveryTaskUseCase,
    ClaimDeliveryTaskUseCase,
    ReceivePackageUseCase,
    VerifyRentalRecipientUseCase,
    CommitRentalHandoverUseCase,
    MarkRentalNoShowUseCase,
    GetRentalPickupCodeUseCase,
    GetRentalHandoverPreviewUseCase,
    AssignRentalTaskUseCase,
    ListAdminRentalTasksUseCase,
    ListRentalAssigneesUseCase,
    { provide: LOGISTICS_PORT, useClass: PrismaDeliveryAdapter },
  ],
})
export class DeliveryModule {}
