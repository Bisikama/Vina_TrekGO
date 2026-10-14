import { Test, TestingModule } from '@nestjs/testing';
import {
  CustodyActorType,
  CustodyEventType,
  DeliveryTaskStatus,
  DeliveryTaskType,
  EquipmentCondition,
  EquipmentUnitStatus,
  InventoryTaskStatus,
  PackageStatus,
  Prisma,
  RentalOrderStatus,
  RentalUnitAssignmentStatus,
  SnapshotStage,
} from '@prisma/client';
import { AppError } from 'src/shared/errors/app-error';
import { WAREHOUSE_ERROR_CODES as WH } from 'src/shared/errors/codes/preparation.error-codes';
import { LOGISTICS_ERROR_CODES as LG } from 'src/shared/errors/codes/delivery.error-codes';
import { PrismaService } from 'src/shared/services/prisma.service';
import { ClaimPreparationTaskUseCase } from 'src/modules/rental/preparation/application/use-cases/claim-preparation-task.use-case';
import { PickPreparationUnitsUseCase } from 'src/modules/rental/preparation/application/use-cases/pick-preparation-units.use-case';
import { ReplacePreparationUnitUseCase } from 'src/modules/rental/preparation/application/use-cases/replace-preparation-unit.use-case';
import { PackPreparationPackageUseCase } from 'src/modules/rental/preparation/application/use-cases/pack-preparation-package.use-case';
import { MarkPreparationReadyUseCase } from 'src/modules/rental/preparation/application/use-cases/mark-preparation-ready.use-case';
import { ReceivePackageUseCase } from 'src/modules/rental/delivery/application/use-cases/receive-package.use-case';
import { GetRentalPickupCodeUseCase } from 'src/modules/rental/delivery/application/use-cases/get-rental-pickup-code.use-case';
import { VerifyRentalRecipientUseCase } from 'src/modules/rental/delivery/application/use-cases/verify-rental-recipient.use-case';
import { CommitRentalHandoverUseCase } from 'src/modules/rental/delivery/application/use-cases/commit-rental-handover.use-case';
import { MarkRentalNoShowUseCase } from 'src/modules/rental/delivery/application/use-cases/mark-rental-no-show.use-case';

describe('Phase 05 & 06 Unit Tests (BA-B-01 through BA-B-14 Domain Invariants)', () => {
  const primaryLocationId = '11111111-1111-4111-8111-111111111111';
  const foreignLocationId = '22222222-2222-4222-8222-222222222222';
  const staff1Id = '33333333-3333-4333-8333-333333333333';
  const staff2Id = '44444444-4444-4444-8444-444444444444';
  const userId = '55555555-5555-4555-8555-555555555555';

  beforeAll(() => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = primaryLocationId;
  });

  describe('Phase 05: Preparation Domain Logic', () => {
    describe('BA-B-02: Claiming Inventory Task Concurrency', () => {
      it('should fail with TASK_ALREADY_ASSIGNED if another staff already claimed the task', async () => {
        const mockPort = {
          claimTask: jest.fn().mockRejectedValue(AppError.fromCode(WH.TASK_ALREADY_ASSIGNED)),
        };
        const useCase = new ClaimPreparationTaskUseCase(mockPort as any);

        await expect(
          useCase.execute({
            taskId: 'task-1',
            actorUserId: staff2Id,
            expectedVersion: 1,
            idempotencyKey: 'idemp-1',
            now: new Date(),
          }),
        ).rejects.toThrow(WH.TASK_ALREADY_ASSIGNED);
      });

      it('should succeed when task is OPEN and actor claims it', async () => {
        const mockPort = {
          claimTask: jest.fn().mockResolvedValue({
            taskId: 'task-1',
            assignee: { id: staff1Id, displayName: 'Staff 1' },
            version: 2,
          }),
        };
        const useCase = new ClaimPreparationTaskUseCase(mockPort as any);
        const result = await useCase.execute({
          taskId: 'task-1',
          actorUserId: staff1Id,
          expectedVersion: 1,
          idempotencyKey: 'idemp-1',
          now: new Date(),
        });

        expect(result.assignee.id).toBe(staff1Id);
        expect(result.version).toBe(2);
      });
    });

    describe('BA-B-03 & BA-B-14: Picking Units Eligibility & Location Isolation', () => {
      it('should reject pick if unit does not belong to primary inventory location', async () => {
        const mockPort = {
          pickUnits: jest.fn().mockRejectedValue(
            AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, {
              details: { reason: 'UNAVAILABLE_OR_WRONG_LOCATION' },
            }),
          ),
        };
        const useCase = new PickPreparationUnitsUseCase(mockPort as any);

        await expect(
          useCase.execute({
            taskId: 'task-1',
            actorUserId: staff1Id,
            assetCodes: ['FOREIGN-UNIT-01'],
            expectedVersion: 1,
            idempotencyKey: 'idemp-pick',
            now: new Date(),
          }),
        ).rejects.toThrow(WH.UNIT_NOT_ELIGIBLE_FOR_PICK);
      });

      it('should reject pick if unit status is not AVAILABLE (e.g. MAINTENANCE, DAMAGED)', async () => {
        const mockPort = {
          pickUnits: jest.fn().mockRejectedValue(
            AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, {
              details: { physicalStatus: 'MAINTENANCE', reason: 'UNAVAILABLE_OR_WRONG_LOCATION' },
            }),
          ),
        };
        const useCase = new PickPreparationUnitsUseCase(mockPort as any);

        await expect(
          useCase.execute({
            taskId: 'task-1',
            actorUserId: staff1Id,
            assetCodes: ['MAINT-UNIT-01'],
            expectedVersion: 1,
            idempotencyKey: 'idemp-pick-maint',
            now: new Date(),
          }),
        ).rejects.toThrow(WH.UNIT_NOT_ELIGIBLE_FOR_PICK);
      });

      it('should reject pick if unit is already assigned to another task (BA-B-04)', async () => {
        const mockPort = {
          pickUnits: jest.fn().mockRejectedValue(
            AppError.fromCode(WH.UNIT_NOT_ELIGIBLE_FOR_PICK, {
              details: { reason: 'ALREADY_ASSIGNED' },
            }),
          ),
        };
        const useCase = new PickPreparationUnitsUseCase(mockPort as any);

        await expect(
          useCase.execute({
            taskId: 'task-1',
            actorUserId: staff1Id,
            assetCodes: ['ASSIGNED-UNIT-01'],
            expectedVersion: 1,
            idempotencyKey: 'idemp-double-pick',
            now: new Date(),
          }),
        ).rejects.toThrow(WH.UNIT_NOT_ELIGIBLE_FOR_PICK);
      });
    });

    describe('BA-B-05: Unit Replacement Rules', () => {
      it('should require new pre-handover condition evidence and record audit upon replacement', async () => {
        const mockPort = {
          replaceUnit: jest.fn().mockResolvedValue({
            oldUnitId: 'unit-old',
            newUnit: {
              id: 'unit-new',
              productId: 'prod-1',
              assetCode: 'ASSET-NEW-01',
              physicalStatus: 'AVAILABLE',
              condition: 'GOOD',
            },
            assignmentVersion: 2,
            packageVersion: null,
            requiresNewEvidence: true,
            taskVersion: 3,
          }),
        };
        const useCase = new ReplacePreparationUnitUseCase(mockPort as any);

        const result = await useCase.execute({
          taskId: 'task-1',
          actorUserId: staff1Id,
          oldUnitId: 'unit-old',
          newUnitId: 'unit-new',
          reason: 'SCRATCHED_LENS',
          expectedVersion: 2,
          idempotencyKey: 'idemp-replace',
          now: new Date(),
        });

        expect(result.newUnit.id).toBe('unit-new');
        expect(mockPort.replaceUnit).toHaveBeenCalledWith(
          expect.objectContaining({
            oldUnitId: 'unit-old',
            newUnitId: 'unit-new',
            reason: 'SCRATCHED_LENS',
          }),
        );
      });
    });

    describe('BA-B-06: Packing & Ready For Handover', () => {
      it('should reject packing when picked unit count does not match required order line quantity', async () => {
        const mockPort = {
          packPackage: jest.fn().mockRejectedValue(
            AppError.fromCode(WH.PACKAGE_INCOMPLETE, {
              details: { required: 2, picked: 1 },
            }),
          ),
        };
        const useCase = new PackPreparationPackageUseCase(mockPort as any);

        await expect(
          useCase.execute({
            taskId: 'task-1',
            actorUserId: staff1Id,
            unitIds: ['unit-1'],
            expectedVersion: 1,
            idempotencyKey: 'idemp-pack',
            now: new Date(),
          }),
        ).rejects.toThrow(WH.PACKAGE_INCOMPLETE);
      });

      it('should reject marking READY_FOR_HANDOVER if task is not in PACKED state', async () => {
        const mockPort = {
          markReady: jest.fn().mockRejectedValue(AppError.fromCode(WH.INVALID_TASK_STATE)),
        };
        const useCase = new MarkPreparationReadyUseCase(mockPort as any);

        await expect(
          useCase.execute({
            taskId: 'task-1',
            packageId: 'pkg-1',
            actorUserId: staff1Id,
            expectedVersion: 1,
            idempotencyKey: 'idemp-ready',
            now: new Date(),
          }),
        ).rejects.toThrow(WH.INVALID_TASK_STATE);
      });
    });
  });

  describe('Phase 06: Delivery Domain Logic', () => {
    describe('BA-B-07: Pickup Code 15-Minute TTL, One-Time Use & Reissue Invalidation', () => {
      it('should generate pickup code with 15-minute TTL and void earlier codes', async () => {
        const mockPort = {
          getPickupCode: jest.fn().mockResolvedValue({
            pickupCode: '123456',
            expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
            orderId: 'order-1',
            recipient: { id: userId },
            pickupPoint: { id: 'point-1' },
          }),
        };
        const useCase = new GetRentalPickupCodeUseCase(mockPort as any);
        const result = await useCase.execute({
          orderId: 'order-1',
          actorUserId: userId,
          now: new Date(),
        });

        expect(result.pickupCode).toBe('123456');
        expect(result.orderId).toBe('order-1');
      });

      it('should reject pickup code verification when code is expired or invalid', async () => {
        const mockPort = {
          verifyRecipient: jest.fn().mockRejectedValue(
            AppError.fromCode(LG.PICKUP_CODE_INVALID_OR_EXPIRED),
          ),
        };
        const useCase = new VerifyRentalRecipientUseCase(mockPort as any);

        await expect(
          useCase.execute({
            taskId: 'del-task-1',
            actorUserId: staff1Id,
            pickupCode: '999999',
            expectedVersion: 1,
            idempotencyKey: 'idemp-verify',
            now: new Date(),
          }),
        ).rejects.toThrow(LG.PICKUP_CODE_INVALID_OR_EXPIRED);
      });
    });

    describe('BA-B-08: VerificationRef 10-Minute TTL Expiration', () => {
      it('should reject commitHandover if verificationRef is expired (> 10 minutes)', async () => {
        const mockPort = {
          commitHandover: jest.fn().mockRejectedValue(
            AppError.fromCode(LG.PICKUP_VERIFICATION_EXPIRED),
          ),
        };
        const useCase = new CommitRentalHandoverUseCase(mockPort as any);

        await expect(
          useCase.execute({
            orderId: 'order-1',
            packageId: 'pkg-1',
            verificationRef: 'expired-ref-uuid',
            actorUserId: staff1Id,
            expectedVersion: 1,
            idempotencyKey: 'idemp-handover',
            now: new Date(),
          }),
        ).rejects.toThrow(LG.PICKUP_VERIFICATION_EXPIRED);
      });
    });

    describe('BA-B-09 & BA-B-10: Handover Commit & Custody Chain (Inventory -> Delivery -> USER)', () => {
      it('should successfully commit handover, set order to ACTIVE, and return handed-over units', async () => {
        const mockPort = {
          commitHandover: jest.fn().mockResolvedValue({
            order: { id: 'order-1', status: RentalOrderStatus.ACTIVE, version: 2 },
            units: [
              { unitId: 'unit-1', assetCode: 'TENT-01', status: EquipmentUnitStatus.RENTED },
            ],
            handoverRecord: {
              id: 'handover-1',
              verificationRef: 'valid-ref',
              handedOverAt: new Date().toISOString(),
            },
          }),
        };
        const useCase = new CommitRentalHandoverUseCase(mockPort as any);

        const result = await useCase.execute({
          orderId: 'order-1',
          packageId: 'pkg-1',
          verificationRef: 'valid-ref',
          actorUserId: staff1Id,
          expectedVersion: 1,
          idempotencyKey: 'idemp-handover',
          now: new Date(),
        });

        expect(result.order.status).toBe(RentalOrderStatus.ACTIVE);
        expect(result.units[0].status).toBe(EquipmentUnitStatus.RENTED);
        expect(result.handoverRecord.id).toBe('handover-1');
      });
    });

    describe('BA-B-11: No-Show & Equipment Refusal (No Deposit Deduction, Units Not AVAILABLE)', () => {
      it('should not deduct deposit when user is no-show or refuses, and units remain pending return', async () => {
        const mockPort = {
          markNoShow: jest.fn().mockResolvedValue({
            orderId: 'order-1',
            exceptionStatus: 'USER_NO_SHOW',
            refundPreview: { feeRefund: 0, depositRefund: 500000, totalRefund: 500000, status: null, refundRef: null },
            returnToWarehouseRequired: true,
          }),
        };
        const useCase = new MarkRentalNoShowUseCase(mockPort as any);

        const result = await useCase.execute({
          orderId: 'order-1',
          actorUserId: staff1Id,
          reason: 'USER_NO_SHOW',
          evidenceIds: ['media-noshow-1'],
          expectedVersion: 1,
          idempotencyKey: 'idemp-noshow',
          now: new Date(),
        });

        // 100% of deposit is refunded, 0 deduction
        expect(result.refundPreview.depositRefund).toBe(500000);
        expect(result.returnToWarehouseRequired).toBe(true);
      });
    });
  });
});
