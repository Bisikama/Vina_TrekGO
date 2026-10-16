import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { SupabaseService } from '../../shared/services/supabase.service';
import {
  DELIVERY_PORT,
  LOGISTICS_PORT,
  DeliveryPort,
} from './delivery/application/ports/delivery.port';
import { DeliveryModule } from './delivery/delivery.module';
import { DeliveryTaskController } from './delivery/presentation/controllers/delivery-task.controller';
import { RentalHandoverController } from './delivery/presentation/controllers/rental-handover.controller';
import { RentalTaskAdminController } from './delivery/presentation/controllers/rental-task-admin.controller';
import { PrismaDeliveryAdapter } from './delivery/infrastructure/adapters/prisma-delivery.adapter';
import { ListDeliveryTasksUseCase } from './delivery/application/use-cases/list-delivery-tasks.use-case';
import { GetDeliveryTaskUseCase } from './delivery/application/use-cases/get-delivery-task.use-case';
import { ClaimDeliveryTaskUseCase } from './delivery/application/use-cases/claim-delivery-task.use-case';
import { ReceivePackageUseCase } from './delivery/application/use-cases/receive-package.use-case';
import { VerifyRentalRecipientUseCase } from './delivery/application/use-cases/verify-rental-recipient.use-case';
import { CommitRentalHandoverUseCase } from './delivery/application/use-cases/commit-rental-handover.use-case';
import { MarkRentalNoShowUseCase } from './delivery/application/use-cases/mark-rental-no-show.use-case';
import { GetRentalPickupCodeUseCase } from './delivery/application/use-cases/get-rental-pickup-code.use-case';
import { GetRentalHandoverPreviewUseCase } from './delivery/application/use-cases/get-rental-handover-preview.use-case';
import { AssignRentalTaskUseCase } from './delivery/application/use-cases/assign-rental-task.use-case';
import { ListAdminRentalTasksUseCase } from './delivery/application/use-cases/list-admin-rental-tasks.use-case';
import { ListRentalAssigneesUseCase } from './delivery/application/use-cases/list-rental-assignees.use-case';

import {
  PREPARATION_TASK_PORT,
  WAREHOUSE_TASK_PORT,
  PreparationTaskPort,
} from './preparation/application/ports/preparation-task.port';
import { PreparationModule } from './preparation/preparation.module';
import { PreparationTaskController } from './preparation/presentation/controllers/preparation-task.controller';
import { PrismaPreparationTaskAdapter } from './preparation/infrastructure/adapters/prisma-preparation-task.adapter';
import { ListPreparationTasksUseCase } from './preparation/application/use-cases/list-preparation-tasks.use-case';
import { GetPreparationTaskUseCase } from './preparation/application/use-cases/get-preparation-task.use-case';
import { PickPreparationUnitsUseCase } from './preparation/application/use-cases/pick-preparation-units.use-case';
import { SavePreHandoverConditionUseCase } from './preparation/application/use-cases/save-pre-handover-condition.use-case';
import { PackPreparationPackageUseCase } from './preparation/application/use-cases/pack-preparation-package.use-case';
import { MarkPreparationReadyUseCase } from './preparation/application/use-cases/mark-preparation-ready.use-case';
import { ReplacePreparationUnitUseCase } from './preparation/application/use-cases/replace-preparation-unit.use-case';
import { ClaimPreparationTaskUseCase } from './preparation/application/use-cases/claim-preparation-task.use-case';
import { RequestPreparationTransferUseCase } from './preparation/application/use-cases/request-preparation-transfer.use-case';
import { ListReplacementCandidatesUseCase } from './preparation/application/use-cases/list-replacement-candidates.use-case';
import { ListPickCandidatesUseCase } from './preparation/application/use-cases/list-pick-candidates.use-case';

describe('Rental Terminology Hotfix — NestJS Module Bootstrap & DI Token Resolution', () => {
  const mockPrismaService = {};
  const mockSupabaseService = {};

  describe('P0-01 Fix: DeliveryModule DI Tokens & Provider Resolution', () => {
    it('DELIVERY_PORT and LOGISTICS_PORT must be distinct Symbols (no self-reference)', () => {
      expect(typeof DELIVERY_PORT).toBe('symbol');
      expect(typeof LOGISTICS_PORT).toBe('symbol');
      expect(DELIVERY_PORT).not.toBe(LOGISTICS_PORT);
      expect(DELIVERY_PORT.toString()).toContain('DELIVERY_PORT');
      expect(LOGISTICS_PORT.toString()).toContain('LOGISTICS_PORT');
    });

    it('DeliveryModule compiles and resolves DELIVERY_PORT and LOGISTICS_PORT to the same adapter instance', async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [DeliveryModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .overrideProvider(SupabaseService)
        .useValue(mockSupabaseService)
        .compile();

      const deliveryPort = moduleRef.get<DeliveryPort>(DELIVERY_PORT);
      const logisticsPort = moduleRef.get<DeliveryPort>(LOGISTICS_PORT);

      expect(deliveryPort).toBeDefined();
      expect(logisticsPort).toBeDefined();
      expect(deliveryPort).toBeInstanceOf(PrismaDeliveryAdapter);
      expect(logisticsPort).toBe(deliveryPort); // alias resolves to same singleton instance

      // Verify controllers resolve
      expect(moduleRef.get(DeliveryTaskController)).toBeInstanceOf(DeliveryTaskController);
      expect(moduleRef.get(RentalHandoverController)).toBeInstanceOf(RentalHandoverController);
      expect(moduleRef.get(RentalTaskAdminController)).toBeInstanceOf(RentalTaskAdminController);

      // Verify all 12 use cases resolve
      expect(moduleRef.get(ListDeliveryTasksUseCase)).toBeInstanceOf(ListDeliveryTasksUseCase);
      expect(moduleRef.get(GetDeliveryTaskUseCase)).toBeInstanceOf(GetDeliveryTaskUseCase);
      expect(moduleRef.get(ClaimDeliveryTaskUseCase)).toBeInstanceOf(ClaimDeliveryTaskUseCase);
      expect(moduleRef.get(ReceivePackageUseCase)).toBeInstanceOf(ReceivePackageUseCase);
      expect(moduleRef.get(VerifyRentalRecipientUseCase)).toBeInstanceOf(VerifyRentalRecipientUseCase);
      expect(moduleRef.get(CommitRentalHandoverUseCase)).toBeInstanceOf(CommitRentalHandoverUseCase);
      expect(moduleRef.get(MarkRentalNoShowUseCase)).toBeInstanceOf(MarkRentalNoShowUseCase);
      expect(moduleRef.get(GetRentalPickupCodeUseCase)).toBeInstanceOf(GetRentalPickupCodeUseCase);
      expect(moduleRef.get(GetRentalHandoverPreviewUseCase)).toBeInstanceOf(GetRentalHandoverPreviewUseCase);
      expect(moduleRef.get(AssignRentalTaskUseCase)).toBeInstanceOf(AssignRentalTaskUseCase);
      expect(moduleRef.get(ListAdminRentalTasksUseCase)).toBeInstanceOf(ListAdminRentalTasksUseCase);
      expect(moduleRef.get(ListRentalAssigneesUseCase)).toBeInstanceOf(ListRentalAssigneesUseCase);
    });
  });

  describe('P0-01 Fix: PreparationModule DI Tokens & Provider Resolution', () => {
    it('PREPARATION_TASK_PORT and WAREHOUSE_TASK_PORT must be distinct Symbols (no self-reference)', () => {
      expect(typeof PREPARATION_TASK_PORT).toBe('symbol');
      expect(typeof WAREHOUSE_TASK_PORT).toBe('symbol');
      expect(PREPARATION_TASK_PORT).not.toBe(WAREHOUSE_TASK_PORT);
      expect(PREPARATION_TASK_PORT.toString()).toContain('PREPARATION_TASK_PORT');
      expect(WAREHOUSE_TASK_PORT.toString()).toContain('WAREHOUSE_TASK_PORT');
    });

    it('PreparationModule compiles and resolves PREPARATION_TASK_PORT and WAREHOUSE_TASK_PORT to the same adapter instance', async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [PreparationModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrismaService)
        .overrideProvider(SupabaseService)
        .useValue(mockSupabaseService)
        .compile();

      const prepPort = moduleRef.get<PreparationTaskPort>(PREPARATION_TASK_PORT);
      const warehousePort = moduleRef.get<PreparationTaskPort>(WAREHOUSE_TASK_PORT);

      expect(prepPort).toBeDefined();
      expect(warehousePort).toBeDefined();
      expect(prepPort).toBeInstanceOf(PrismaPreparationTaskAdapter);
      expect(warehousePort).toBe(prepPort); // alias resolves to same singleton instance

      // Verify controller resolves
      expect(moduleRef.get(PreparationTaskController)).toBeInstanceOf(PreparationTaskController);

      // Verify all 11 use cases resolve
      expect(moduleRef.get(ListPreparationTasksUseCase)).toBeInstanceOf(ListPreparationTasksUseCase);
      expect(moduleRef.get(GetPreparationTaskUseCase)).toBeInstanceOf(GetPreparationTaskUseCase);
      expect(moduleRef.get(PickPreparationUnitsUseCase)).toBeInstanceOf(PickPreparationUnitsUseCase);
      expect(moduleRef.get(SavePreHandoverConditionUseCase)).toBeInstanceOf(SavePreHandoverConditionUseCase);
      expect(moduleRef.get(PackPreparationPackageUseCase)).toBeInstanceOf(PackPreparationPackageUseCase);
      expect(moduleRef.get(MarkPreparationReadyUseCase)).toBeInstanceOf(MarkPreparationReadyUseCase);
      expect(moduleRef.get(ReplacePreparationUnitUseCase)).toBeInstanceOf(ReplacePreparationUnitUseCase);
      expect(moduleRef.get(ClaimPreparationTaskUseCase)).toBeInstanceOf(ClaimPreparationTaskUseCase);
      expect(moduleRef.get(RequestPreparationTransferUseCase)).toBeInstanceOf(RequestPreparationTransferUseCase);
      expect(moduleRef.get(ListReplacementCandidatesUseCase)).toBeInstanceOf(ListReplacementCandidatesUseCase);
      expect(moduleRef.get(ListPickCandidatesUseCase)).toBeInstanceOf(ListPickCandidatesUseCase);
    });
  });
});
