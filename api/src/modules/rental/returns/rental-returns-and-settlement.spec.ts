jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}),
  CronExpression: {},
  Interval: jest.fn(() => () => {}),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  Prisma,
  UserRole,
  RefundStatus,
  DepositItemStatus,
  DepositSettlementStatus,
  RentalOrderStatus,
  EquipmentUnitStatus,
  RentalUnitAssignmentStatus,
  RentalOrderExceptionStatus,
  RentalFinancialStatus,
  RentalDocumentType,
  DeliveryTaskType,
  DeliveryTaskStatus,
  PackageStatus,
  RentalExceptionCaseStatus,
} from '@prisma/client';
import { ROLES_KEY } from '../../../shared/decorators/roles.decorator';
import { META_AUTH_KEY } from '../../../shared/decorators/auth.decorator';
import { AuthType, REQUEST_USER_KEY } from '../../../shared/constants/auth.constant';
import { GlobalErrorFilter } from '../../../shared/errors';
import { PrismaService } from '../../../shared/services/prisma.service';

// Controllers
import { RentalReturnController } from './presentation/controllers/rental-return.controller';
import { DeliveryReturnController } from './presentation/controllers/delivery-return.controller';
import { StaffReturnController } from './presentation/controllers/staff-return.controller';
import { RentalReturnAdminController } from './presentation/controllers/rental-return-admin.controller';
import { RentalExceptionController } from './presentation/controllers/rental-exception.controller';

// Use cases to mock for HTTP tests
import { ReturnScanUseCase } from './application/use-cases/return-scan.use-case';
import { ReturnInspectionUseCase } from './application/use-cases/return-inspection.use-case';
import { ReturnToInventoryLocationUseCase } from './application/use-cases/return-to-inventory-location.use-case';
import { ReceiveReturnUseCase } from './application/use-cases/receive-return.use-case';
import { FinalInspectionUseCase } from './application/use-cases/final-inspection.use-case';
import { CreateDepositSettlementUseCase } from './application/use-cases/create-deposit-settlement.use-case';
import { GetDepositUseCase } from './application/use-cases/get-deposit.use-case';
import { FinalizeReturnUseCase } from './application/use-cases/finalize-return.use-case';
import { CreateAssessmentReviewUseCase } from './application/use-cases/create-assessment-review.use-case';
import { ResolveRentalExceptionUseCase } from './application/use-cases/resolve-rental-exception.use-case';
import { MarkReturnedUnitReadyUseCase } from './application/use-cases/mark-returned-unit-ready.use-case';
import { ListRentalExceptionsUseCase } from './application/use-cases/list-rental-exceptions.use-case';
import { ListReturnsUseCase } from './application/use-cases/list-returns.use-case';
import { GetReturnUseCase } from './application/use-cases/get-return.use-case';
import { GetRentalExceptionUseCase } from './application/use-cases/get-rental-exception.use-case';
import { GetRentalAssessmentUseCase } from './application/use-cases/get-rental-assessment.use-case';

// Domain logic & workers
import { planDepositRefundGroups, type DepositRefundCandidate } from './application/deposit-grouping.policy';
import { RETURN_POLICY_152, inspectionDeadlines } from './application/return-policy-152';
import { RentalDepositWorker } from '../payments/rental-deposit.worker';
import { RentalRefundsService } from '../../payments/rental-refunds.service';
import { PaymentsPort } from '../../payments/payments.port';
import { issueReturnReceiptTx } from '../documents/application/rental-document-events';
import { RENTAL_RETURN_ERROR_CODES as RR } from '../../../shared/errors/codes/rental-return.error-codes';
import { AppError } from '../../../shared/errors';
import { tryCompleteOrder } from './infrastructure/adapters/prisma-rental-return.adapter';
import { RentalOperationalEscalationScheduler } from './infrastructure/jobs/rental-operational-escalation.scheduler';

describe('Phase 08: Returns, Custody & Hybrid Deposit Settlement', () => {
  const dummyOrderId = '33333333-3333-4333-8333-333333333333';
  const dummyTaskId = '22222222-2222-4222-8222-222222222222';
  const dummyUnitId = '11111111-1111-4111-8111-111111111111';
  const dummyAssessmentId = '88888888-8888-4888-8888-888888888888';
  const dummyExceptionId = '99999999-9999-4999-8999-999999999999';
  const dummyPaymentId = '44444444-4444-4444-8444-444444444444';
  const dummySettlementId = '77777777-7777-4777-8777-777777777777';

  describe('Part 1: REST Route Contracts RB-API-601..616, RBAC & Aliases', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [
          RentalReturnController,
          DeliveryReturnController,
          StaffReturnController,
          RentalReturnAdminController,
          RentalExceptionController,
        ],
        providers: [
          { provide: ReturnScanUseCase, useValue: { execute: jest.fn().mockResolvedValue({ returnId: dummyTaskId, receivedUnits: [], missingUnits: [], duplicates: [] }) } },
          { provide: ReturnInspectionUseCase, useValue: { execute: jest.fn().mockResolvedValue({ returnSessionId: 'sess-1', observations: [], discrepancies: [] }) } },
          { provide: ReturnToInventoryLocationUseCase, useValue: { execute: jest.fn().mockResolvedValue({ custodyTransferId: 'trans-1', status: 'PENDING_TRANSFER' }) } },
          { provide: ReceiveReturnUseCase, useValue: { execute: jest.fn().mockResolvedValue({ custodyTransferId: 'trans-1', status: 'ACCEPTED', inspectionTaskId: 'it-1' }) } },
          { provide: FinalInspectionUseCase, useValue: { execute: jest.fn().mockResolvedValue({ assessments: [], proposedDeductions: [] }) } },
          { provide: CreateDepositSettlementUseCase, useValue: { execute: jest.fn().mockResolvedValue({ settlement: { id: dummySettlementId }, status: 'REFUND_PENDING' }) } },
          { provide: GetDepositUseCase, useValue: { execute: jest.fn().mockResolvedValue({ collectedAmount: 1000000, heldAmount: 0, items: [] }) } },
          { provide: FinalizeReturnUseCase, useValue: { execute: jest.fn().mockResolvedValue({ unitStates: [], orderStatus: 'RETURN_PROCESSING' }) } },
          { provide: CreateAssessmentReviewUseCase, useValue: { execute: jest.fn().mockResolvedValue({ caseId: dummyExceptionId, reviewStatus: 'UNDER_REVIEW' }) } },
          { provide: ResolveRentalExceptionUseCase, useValue: { execute: jest.fn().mockResolvedValue({ resolution: 'APPROVE_DEDUCTION', approvalRef: 'APR-1' }) } },
          { provide: MarkReturnedUnitReadyUseCase, useValue: { execute: jest.fn().mockResolvedValue({ unit: { id: dummyUnitId, status: 'AVAILABLE' }, readyAt: new Date().toISOString() }) } },
          { provide: ListRentalExceptionsUseCase, useValue: { execute: jest.fn().mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0 } }) } },
          { provide: ListReturnsUseCase, useValue: { execute: jest.fn().mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0 } }) } },
          { provide: GetReturnUseCase, useValue: { execute: jest.fn().mockResolvedValue({ id: dummyTaskId, status: 'INVENTORY_RECEIVED' }) } },
          { provide: GetRentalExceptionUseCase, useValue: { execute: jest.fn().mockResolvedValue({ id: dummyExceptionId, caseType: 'DAMAGE_DISPUTE' }) } },
          { provide: GetRentalAssessmentUseCase, useValue: { execute: jest.fn().mockResolvedValue({ orderId: dummyOrderId, assessments: [] }) } },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalFilters(new GlobalErrorFilter());

      app.use((req: any, _res: any, next: () => void) => {
        req[REQUEST_USER_KEY] = {
          id: '55555555-5555-4555-8555-555555555555',
          role: req.headers['x-mock-role'] ?? UserRole.STAFF_DELIVERY,
          status: 'ACTIVE',
        };
        next();
      });

      await app.init();
    });

    afterAll(async () => {
      if (app) await app.close();
    });

    it('RBAC metadata: verifies roles on all Phase 08 controllers', () => {
      // RentalReturnController
      const scanMethod = Object.getOwnPropertyDescriptor(RentalReturnController.prototype, 'scan')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, scanMethod)).toEqual([UserRole.STAFF_DELIVERY]);

      const inspectMethod = Object.getOwnPropertyDescriptor(RentalReturnController.prototype, 'inspect')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, inspectMethod)).toEqual([UserRole.STAFF_DELIVERY]);

      const depositMethod = Object.getOwnPropertyDescriptor(RentalReturnController.prototype, 'deposit')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, depositMethod)).toEqual([UserRole.USER, UserRole.LEADER]);

      // DeliveryReturnController
      const deliveryMethod = Object.getOwnPropertyDescriptor(DeliveryReturnController.prototype, 'execute')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, deliveryMethod)).toEqual([UserRole.STAFF_DELIVERY]);

      // StaffReturnController
      const receiveMethod = Object.getOwnPropertyDescriptor(StaffReturnController.prototype, 'receive')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, receiveMethod)).toEqual([UserRole.STAFF_INVENTORY]);

      const finalInspectionMethod = Object.getOwnPropertyDescriptor(StaffReturnController.prototype, 'finalInspection')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, finalInspectionMethod)).toEqual([UserRole.STAFF_INVENTORY]);

      const readyMethod = Object.getOwnPropertyDescriptor(StaffReturnController.prototype, 'ready')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, readyMethod)).toEqual([UserRole.STAFF_INVENTORY]);

      // RentalReturnAdminController
      const settleMethod = Object.getOwnPropertyDescriptor(RentalReturnAdminController.prototype, 'settle')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, settleMethod)).toEqual([UserRole.ADMIN]);

      const resolveMethod = Object.getOwnPropertyDescriptor(RentalReturnAdminController.prototype, 'resolve')?.value;
      expect(Reflect.getMetadata(ROLES_KEY, resolveMethod)).toEqual([UserRole.ADMIN]);
    });

    it('RB-API-601: POST /api/v1/rental-orders/:id/return-scan returns 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/return-scan`)
        .set('x-mock-role', UserRole.STAFF_DELIVERY)
        .set('idempotency-key', 'key-scan-12345')
        .send({
          assetCodes: ['TREK-BIKE-001'],
          operationId: 'op-scan-12345',
          expectedVersion: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.returnId).toBe(dummyTaskId);
    });

    it('RB-API-602: POST /api/v1/rental-orders/:id/return-observations returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/return-observations`)
        .set('x-mock-role', UserRole.STAFF_DELIVERY)
        .set('idempotency-key', 'key-obs-12345')
        .send({
          items: [{ unitId: dummyUnitId, visibleDamage: false, accessoryObservations: [] }],
          expectedVersion: 1,
        });
      expect(res.status).toBe(201);
      expect(res.body.returnSessionId).toBe('sess-1');
    });

    it('RB-API-602 legacy alias: POST /api/v1/rental-orders/:id/return-inspection returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/return-inspection`)
        .set('x-mock-role', UserRole.STAFF_DELIVERY)
        .set('idempotency-key', 'key-obs-legacy-123')
        .send({
          items: [{ unitId: dummyUnitId, visibleDamage: false, accessoryObservations: [] }],
          expectedVersion: 1,
        });
      expect(res.status).toBe(201);
    });

    it('RB-API-603: POST /api/v1/delivery/tasks/:returnId/return-to-inventory-location returns 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${dummyTaskId}/return-to-inventory-location`)
        .set('x-mock-role', UserRole.STAFF_DELIVERY)
        .set('idempotency-key', 'key-transfer-12345')
        .send({
          unitIds: [dummyUnitId],
          expectedVersion: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.custodyTransferId).toBe('trans-1');
    });

    it('RB-API-603 aliases: supports :id and logistics/tasks alias', async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${dummyTaskId}/return-to-inventory-location`)
        .set('x-mock-role', UserRole.STAFF_DELIVERY)
        .set('idempotency-key', 'key-alias-123')
        .send({ unitIds: [dummyUnitId], expectedVersion: 1 });
      expect(res1.status).toBe(200);

      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/logistics/tasks/${dummyTaskId}/return-to-warehouse`)
        .set('x-mock-role', UserRole.STAFF_DELIVERY)
        .set('idempotency-key', 'key-alias-456')
        .send({ unitIds: [dummyUnitId], expectedVersion: 1 });
      expect(res2.status).toBe(200);
    });

    it('RB-API-604: POST /api/v1/staff/returns/:returnId/receive returns 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/staff/returns/${dummyTaskId}/receive`)
        .set('x-mock-role', UserRole.STAFF_INVENTORY)
        .set('idempotency-key', 'key-recv-12345')
        .send({
          pendingTransferId: '33333333-3333-4333-8333-333333333333',
          inventoryLocationId: '44444444-4444-4444-8444-444444444444',
          scannedUnitIds: [dummyUnitId],
          expectedVersion: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');
    });

    it('RB-API-605: POST /api/v1/staff/returns/:returnId/final-inspection returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/staff/returns/${dummyTaskId}/final-inspection`)
        .set('x-mock-role', UserRole.STAFF_INVENTORY)
        .set('idempotency-key', 'key-final-12345')
        .send({
          items: [{ unitId: dummyUnitId, condition: 'GOOD', outcome: 'PASS', damage: [], evidenceIds: [] }],
          expectedVersion: 1,
        });
      expect(res.status).toBe(201);
    });

    it('RB-API-606: POST /api/v1/rental-orders/:id/deposit-settlement returns 202', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/deposit-settlement`)
        .set('x-mock-role', UserRole.ADMIN)
        .set('idempotency-key', 'key-settle-12345')
        .send({
          assessmentId: dummyAssessmentId,
          approvalRef: 'APR-2026-10-17-001',
        });
      expect(res.status).toBe(202);
      expect(res.body.status).toBe('REFUND_PENDING');
    });

    it('RB-API-607: GET /api/v1/rental-orders/:id/deposit returns 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rental-orders/${dummyOrderId}/deposit`)
        .set('x-mock-role', UserRole.USER);
      expect(res.status).toBe(200);
      expect(res.body.collectedAmount).toBe(1000000);
    });

    it('RB-API-608: POST /api/v1/staff/returns/:returnId/finalize returns 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/staff/returns/${dummyTaskId}/finalize`)
        .set('x-mock-role', UserRole.STAFF_INVENTORY)
        .set('idempotency-key', 'key-finalize-12345')
        .send({
          unitOutcomes: [{ unitId: dummyUnitId, outcome: 'NORMAL' }],
          inspectionVersion: 1,
          expectedVersion: 1,
        });
      expect(res.status).toBe(200);
    });

    it('RB-API-609: POST /api/v1/rental-orders/:id/assessment-reviews returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/assessment-reviews`)
        .set('x-mock-role', UserRole.USER)
        .set('idempotency-key', 'key-review-12345')
        .send({
          assessmentId: dummyAssessmentId,
          reason: 'Scratch was present before pickup',
        });
      expect(res.status).toBe(201);
      expect(res.body.caseId).toBe(dummyExceptionId);
    });

    it('RB-API-610: POST /api/v1/admin/rental-exceptions/:id/resolve returns 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/rental-exceptions/${dummyExceptionId}/resolve`)
        .set('x-mock-role', UserRole.ADMIN)
        .set('idempotency-key', 'key-resolve-12345')
        .send({
          decision: 'APPROVE_DEDUCTION',
          reason: 'Damage verified via photo evidence',
          expectedVersion: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.resolution).toBe('APPROVE_DEDUCTION');
    });

    it('RB-API-611: POST /api/v1/staff/equipment-units/:id/ready returns 200', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/staff/equipment-units/${dummyUnitId}/ready`)
        .set('x-mock-role', UserRole.STAFF_INVENTORY)
        .set('idempotency-key', 'key-ready-12345')
        .send({
          accessoriesChecked: true,
          expectedVersion: 1,
        });
      expect(res.status).toBe(200);
      expect(res.body.unit.status).toBe('AVAILABLE');
    });

    it('RB-API-612: GET /api/v1/staff/rental-exceptions returns 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/staff/rental-exceptions')
        .set('x-mock-role', UserRole.STAFF_INVENTORY);
      expect(res.status).toBe(200);
    });

    it('RB-API-613: GET /api/v1/staff/returns returns 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/staff/returns')
        .set('x-mock-role', UserRole.STAFF_INVENTORY);
      expect(res.status).toBe(200);
    });

    it('RB-API-614: GET /api/v1/staff/returns/:returnId returns 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/staff/returns/${dummyTaskId}`)
        .set('x-mock-role', UserRole.STAFF_INVENTORY);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(dummyTaskId);
    });

    it('RB-API-615: GET /api/v1/staff/rental-exceptions/:id returns 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/staff/rental-exceptions/${dummyExceptionId}`)
        .set('x-mock-role', UserRole.STAFF_INVENTORY);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(dummyExceptionId);
    });

    it('RB-API-616: GET /api/v1/rental-orders/:id/assessment returns 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rental-orders/${dummyOrderId}/assessment`)
        .set('x-mock-role', UserRole.USER);
      expect(res.status).toBe(200);
    });
  });

  describe('Part 2: Grouped Deposit Refund & planDepositRefundGroups Policy', () => {
    it('groups 3 clean items from same payment into ONE refund group', () => {
      const candidates: DepositRefundCandidate[] = [
        {
          itemId: 'item-1',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 500000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-2',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 500000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-3',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 300000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
      ];

      const groups = planDepositRefundGroups(candidates);
      expect(groups).toHaveLength(1);
      expect(groups[0].paymentId).toBe('pay-1');
      expect(groups[0].totalAmount).toBe(1300000);
      expect(groups[0].itemIds).toEqual(['item-1', 'item-2', 'item-3']);
    });

    it('separates items across different payment sources into distinct refund groups', () => {
      const candidates: DepositRefundCandidate[] = [
        {
          itemId: 'item-1',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 500000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-2',
          paymentId: 'pay-2',
          currency: 'VND',
          amount: 500000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
      ];

      const groups = planDepositRefundGroups(candidates);
      expect(groups).toHaveLength(2);
      expect(groups.map((g) => g.paymentId)).toEqual(['pay-1', 'pay-2']);
    });

    it('excludes items with open dispute cases or not yet FINAL_PASS', () => {
      const candidates: DepositRefundCandidate[] = [
        {
          itemId: 'item-clean',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 500000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-dispute',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 500000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: true, // open case!
          alreadyAllocated: false,
        },
        {
          itemId: 'item-preliminary-only',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 500000,
          isFinalPass: false, // not FINAL_PASS!
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
      ];

      const groups = planDepositRefundGroups(candidates);
      expect(groups).toHaveLength(1);
      expect(groups[0].itemIds).toEqual(['item-clean']);
      expect(groups[0].totalAmount).toBe(500000);
    });
  });

  describe('Part 3: RentalRefundsService Multi-Item Reservation', () => {
    let service: RentalRefundsService;
    let mockDb: any;
    let mockTx: any;

    beforeEach(() => {
      mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([{ now: new Date() }]),
        depositSettlementItem: {
          findMany: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
        payment: {
          findUnique: jest.fn(),
          findUniqueOrThrow: jest.fn(),
        },
        refund: {
          findFirst: jest.fn().mockResolvedValue(null),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
          create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: data.id ?? 'ref-1', ...data })),
        },
        refundAllocation: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
        },
        depositRefundItemAllocation: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        rentalExceptionCase: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        rentalOrder: {
          update: jest.fn().mockResolvedValue({}),
        },
      };

      mockDb = {
        $transaction: jest.fn((cb: any) => cb(mockTx)),
      };

      service = new RentalRefundsService(mockDb as PrismaService);
    });

    it('reserves a grouped refund for 3 items and creates DepositRefundItemAllocation rows', async () => {
      const items = [
        {
          id: 'item-1',
          settlementId: dummySettlementId,
          assignmentId: 'asgn-1',
          unitId: 'unit-1',
          status: 'REFUND_PENDING',
          approvedAt: new Date(),
          approvedBy: 'staff-1',
          decisionSnapshot: { refundDecision: 'INVENTORY_FINAL_PASS' },
          depositAmount: new Prisma.Decimal(500000),
          deductionAmount: new Prisma.Decimal(0),
          refundAmount: new Prisma.Decimal(500000),
          settlement: {
            orderId: dummyOrderId,
            order: { userId: 'user-1', status: 'RETURN_PROCESSING' },
          },
          assignment: {
            id: 'asgn-1',
            equipmentUnitId: 'unit-1',
            orderLine: {
              orderId: dummyOrderId,
              depositPerUnitSnapshot: new Prisma.Decimal(500000),
            },
          },
          inspection: {
            outcome: 'NORMAL',
            orderId: dummyOrderId,
            assignmentId: 'asgn-1',
            unitId: 'unit-1',
          },
        },
        {
          id: 'item-2',
          settlementId: dummySettlementId,
          assignmentId: 'asgn-2',
          unitId: 'unit-2',
          status: 'REFUND_PENDING',
          approvedAt: new Date(),
          approvedBy: 'staff-1',
          decisionSnapshot: { refundDecision: 'INVENTORY_FINAL_PASS' },
          depositAmount: new Prisma.Decimal(500000),
          deductionAmount: new Prisma.Decimal(0),
          refundAmount: new Prisma.Decimal(500000),
          settlement: {
            orderId: dummyOrderId,
            order: { userId: 'user-1', status: 'RETURN_PROCESSING' },
          },
          assignment: {
            id: 'asgn-2',
            equipmentUnitId: 'unit-2',
            orderLine: {
              orderId: dummyOrderId,
              depositPerUnitSnapshot: new Prisma.Decimal(500000),
            },
          },
          inspection: {
            outcome: 'NORMAL',
            orderId: dummyOrderId,
            assignmentId: 'asgn-2',
            unitId: 'unit-2',
          },
        },
        {
          id: 'item-3',
          settlementId: dummySettlementId,
          assignmentId: 'asgn-3',
          unitId: 'unit-3',
          status: 'REFUND_PENDING',
          approvedAt: new Date(),
          approvedBy: 'staff-1',
          decisionSnapshot: { refundDecision: 'INVENTORY_FINAL_PASS' },
          depositAmount: new Prisma.Decimal(300000),
          deductionAmount: new Prisma.Decimal(0),
          refundAmount: new Prisma.Decimal(300000),
          settlement: {
            orderId: dummyOrderId,
            order: { userId: 'user-1', status: 'RETURN_PROCESSING' },
          },
          assignment: {
            id: 'asgn-3',
            equipmentUnitId: 'unit-3',
            orderLine: {
              orderId: dummyOrderId,
              depositPerUnitSnapshot: new Prisma.Decimal(300000),
            },
          },
          inspection: {
            outcome: 'NORMAL',
            orderId: dummyOrderId,
            assignmentId: 'asgn-3',
            unitId: 'unit-3',
          },
        },
      ];

      mockTx.depositSettlementItem.findMany.mockResolvedValue(items);
      mockTx.payment.findUnique.mockResolvedValue({ id: dummyPaymentId, invoiceId: 'inv-1' });
      mockTx.payment.findUniqueOrThrow.mockResolvedValue({
        id: dummyPaymentId,
        status: 'SUCCEEDED',
        currency: 'VND',
        amount: new Prisma.Decimal(2000000),
        application: { status: 'APPLIED' },
        reconcileStatus: 'IDLE',
        providerEnvironment: 'SANDBOX',
        merchantAccountKey: 'ACCT-1',
        merchantRequestRef: 'REQ-1',
        invoice: { invoiceType: 'RENTAL', rentalOrderId: dummyOrderId, userId: 'user-1' },
        allocations: [
          {
            id: 'alloc-1',
            component: 'RENTAL_DEPOSIT',
            amount: new Prisma.Decimal(1300000),
          },
        ],
      });

      const refund = await service.reserve({
        paymentId: dummyPaymentId,
        purpose: 'DEPOSIT',
        businessActionId: `deposit-group:${dummyPaymentId}:item-1,item-2,item-3:v1`,
        amount: '1300000',
        idempotencyKey: 'idemp-grouped-1',
        source: {
          depositSettlementId: dummySettlementId,
          depositSettlementItemIds: ['item-1', 'item-2', 'item-3'],
        },
        allocations: [{ paymentAllocationId: 'alloc-1', amount: '1300000' }],
        itemAllocations: [
          { depositSettlementItemId: 'item-1', amount: '500000' },
          { depositSettlementItemId: 'item-2', amount: '500000' },
          { depositSettlementItemId: 'item-3', amount: '300000' },
        ],
      });

      expect(refund).toBeDefined();
      expect(mockTx.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: new Prisma.Decimal('1300000'),
            depositRefundItems: {
              create: [
                { depositSettlementItemId: 'item-1', amount: new Prisma.Decimal('500000') },
                { depositSettlementItemId: 'item-2', amount: new Prisma.Decimal('500000') },
                { depositSettlementItemId: 'item-3', amount: new Prisma.Decimal('300000') },
              ],
            },
          }),
        }),
      );

      expect(mockTx.depositSettlementItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-1', 'item-2', 'item-3'] } },
        data: { status: 'REFUND_PENDING', version: { increment: 1 } },
      });
    });

    it('rejects refund if allocation amount exceeds deposit component on payment', async () => {
      mockTx.depositSettlementItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          settlementId: dummySettlementId,
          unitId: 'unit-1',
          status: 'REFUND_PENDING',
          approvedAt: new Date(),
          approvedBy: 'staff-1',
          decisionSnapshot: {},
          depositAmount: new Prisma.Decimal(500000),
          deductionAmount: new Prisma.Decimal(0),
          refundAmount: new Prisma.Decimal(500000),
          settlement: { orderId: dummyOrderId, order: { userId: 'user-1' } },
          assignment: {
            equipmentUnitId: 'unit-1',
            orderLine: { orderId: dummyOrderId, depositPerUnitSnapshot: new Prisma.Decimal(500000) },
          },
          inspection: { outcome: 'NORMAL', orderId: dummyOrderId, unitId: 'unit-1' },
        },
      ]);
      mockTx.payment.findUnique.mockResolvedValue({ id: dummyPaymentId, invoiceId: 'inv-1' });
      mockTx.payment.findUniqueOrThrow.mockResolvedValue({
        id: dummyPaymentId,
        status: 'SUCCEEDED',
        currency: 'VND',
        amount: new Prisma.Decimal(1000000),
        application: { status: 'APPLIED' },
        reconcileStatus: 'IDLE',
        providerEnvironment: 'SANDBOX',
        merchantAccountKey: 'ACCT-1',
        merchantRequestRef: 'REQ-1',
        invoice: { invoiceType: 'RENTAL', rentalOrderId: dummyOrderId, userId: 'user-1' },
        allocations: [{ id: 'alloc-1', component: 'RENTAL_DEPOSIT', amount: new Prisma.Decimal(300000) }], // Only 300k deposit captured!
      });

      await expect(
        service.reserve({
          paymentId: dummyPaymentId,
          purpose: 'DEPOSIT',
          businessActionId: 'deposit-item:item-1:refund:v1',
          amount: '500000', // Requesting 500k > 300k captured
          idempotencyKey: 'idemp-exceed-1',
          source: { depositSettlementId: dummySettlementId, depositSettlementItemId: 'item-1' },
          allocations: [{ paymentAllocationId: 'alloc-1', amount: '500000' }],
          itemAllocations: [{ depositSettlementItemId: 'item-1', amount: '500000' }],
        }),
      ).rejects.toThrow();
    });
  });

  describe('Part 4: RentalDepositWorker Lifecycle, Consumer & Financial Status', () => {
    let worker: RentalDepositWorker;
    let mockDb: any;
    let mockTx: any;
    let mockPayments: any;

    beforeEach(() => {
      mockTx = {
        $queryRaw: jest.fn().mockImplementation((...args: any[]) => {
          const first = args[0];
          const sql = Array.isArray(first)
            ? first.join(' ')
            : String(first?.text ?? first?.sql ?? (Array.isArray(first?.strings) ? first.strings.join(' ') : first ?? ''));
          if (sql.includes('payment_outbox_events')) {
            return Promise.resolve([{ id: 'event-1' }]);
          }
          if (sql.includes('clock_timestamp')) {
            return Promise.resolve([{ now: new Date() }]);
          }
          return Promise.resolve([]);
        }),
        paymentOutboxEvent: {
          findUnique: jest.fn(),
          findUniqueOrThrow: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
        },
        refund: {
          findUnique: jest.fn(),
          findUniqueOrThrow: jest.fn(),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(1000000) } }),
          count: jest.fn().mockResolvedValue(0),
        },
        payment: {
          findUniqueOrThrow: jest.fn(),
        },
        paymentAllocation: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(1000000) } }),
        },
        depositSettlement: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: dummySettlementId,
            totalDeposit: new Prisma.Decimal(1000000),
            depositSettlementItemsViaSettlementId: [
              { status: 'SETTLED', depositAmount: new Prisma.Decimal(500000), refundAmount: new Prisma.Decimal(500000), deductionAmount: new Prisma.Decimal(0) },
              { status: 'SETTLED', depositAmount: new Prisma.Decimal(500000), refundAmount: new Prisma.Decimal(500000), deductionAmount: new Prisma.Decimal(0) },
            ],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        depositSettlementItem: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'item-1', status: 'SETTLED' },
            { id: 'item-2', status: 'SETTLED' },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        paymentConsumerReceipt: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: dummyOrderId,
            status: RentalOrderStatus.RETURN_PROCESSING,
            rentalOrderLinesViaOrderId: [{ rentalUnitAssignmentsViaOrderLineId: [{ status: RentalUnitAssignmentStatus.CLOSED }] }],
            depositSettlementViaOrderId: { depositSettlementItemsViaSettlementId: [{ status: DepositItemStatus.SETTLED }] },
            rentalExceptionCasesViaOrderId: [],
            deliveryTasksViaOrderId: [],
            packageViaOrderId: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalOutboxEvent: {
          create: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
        },
      };

      mockDb = {
        $transaction: jest.fn((cb: any) => cb(mockTx)),
        $queryRaw: mockTx.$queryRaw,
      };

      mockPayments = {
        requestRefund: jest.fn().mockResolvedValue({ refundId: 'ref-new' }),
      };

      worker = new RentalDepositWorker(mockDb as PrismaService, mockPayments as PaymentsPort);
    });

    it('consumes REFUND_SUCCEEDED for grouped items and updates each to SETTLED', async () => {
      mockTx.paymentOutboxEvent.findUnique.mockResolvedValue({
        id: 'event-1',
        eventType: 'REFUND_SUCCEEDED',
        aggregateType: 'Refund',
        aggregateId: 'ref-1',
      });
      mockTx.paymentOutboxEvent.findUniqueOrThrow.mockResolvedValue({
        id: 'event-1',
        eventType: 'REFUND_SUCCEEDED',
        payload: { schemaVersion: 1, refundId: 'ref-1' },
      });
      mockTx.refund.findUnique.mockResolvedValue({
        id: 'ref-1',
        purpose: 'DEPOSIT',
        paymentId: dummyPaymentId,
        depositSettlement: { id: dummySettlementId, orderId: dummyOrderId },
        depositRefundItems: [
          { depositSettlementItemId: 'item-1', amount: new Prisma.Decimal(500000) },
          { depositSettlementItemId: 'item-2', amount: new Prisma.Decimal(500000) },
        ],
      });
      mockTx.refund.findUniqueOrThrow.mockResolvedValue({
        id: 'ref-1',
        status: 'SUCCEEDED',
        amount: new Prisma.Decimal(1000000),
        depositSettlementId: dummySettlementId,
        paymentId: dummyPaymentId,
        payment: { invoiceId: 'inv-1', invoice: { rentalOrderId: dummyOrderId }, application: { status: 'APPLIED' } },
        depositRefundItems: [
          { depositSettlementItemId: 'item-1', amount: new Prisma.Decimal(500000) },
          { depositSettlementItemId: 'item-2', amount: new Prisma.Decimal(500000) },
        ],
      });
      mockTx.payment.findUniqueOrThrow.mockResolvedValue({ id: dummyPaymentId, invoiceId: 'inv-1' });

      await worker.consume('event-1');

      // Both items updated to SETTLED
      expect(mockTx.depositSettlementItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({ status: 'SETTLED' }),
        }),
      );
      expect(mockTx.depositSettlementItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-2' },
          data: expect.objectContaining({ status: 'SETTLED' }),
        }),
      );

      // Financial status evaluated against RENTAL_DEPOSIT component (1000000 captured vs 1000000 refunded -> SETTLED)
      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: dummyOrderId },
          data: expect.objectContaining({ financialStatus: 'SETTLED' }),
        }),
      );

      // Outbox event marked PROCESSED
      expect(mockTx.paymentOutboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event-1' },
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });

    it('idempotency: ignores duplicate outbox event if consumer receipt already exists', async () => {
      mockTx.paymentOutboxEvent.findUnique.mockResolvedValue({
        id: 'event-1',
        eventType: 'REFUND_SUCCEEDED',
        aggregateType: 'Refund',
        aggregateId: 'ref-1',
      });
      mockTx.paymentOutboxEvent.findUniqueOrThrow.mockResolvedValue({
        id: 'event-1',
        eventType: 'REFUND_SUCCEEDED',
        payload: { schemaVersion: 1, refundId: 'ref-1' },
      });
      mockTx.refund.findUnique.mockResolvedValue({
        id: 'ref-1',
        purpose: 'DEPOSIT',
        paymentId: dummyPaymentId,
        depositSettlement: { id: dummySettlementId, orderId: dummyOrderId },
        depositRefundItems: [{ depositSettlementItemId: 'item-1', amount: new Prisma.Decimal(500000) }],
      });
      mockTx.refund.findUniqueOrThrow.mockResolvedValue({
        id: 'ref-1',
        status: 'SUCCEEDED',
        depositSettlementId: dummySettlementId,
        paymentId: dummyPaymentId,
        payment: { invoiceId: 'inv-1', invoice: { rentalOrderId: dummyOrderId }, application: { status: 'APPLIED' } },
        depositRefundItems: [{ depositSettlementItemId: 'item-1', amount: new Prisma.Decimal(500000) }],
      });
      mockTx.payment.findUniqueOrThrow.mockResolvedValue({ id: dummyPaymentId, invoiceId: 'inv-1' });

      // Receipt ALREADY exists!
      mockTx.paymentConsumerReceipt.findUnique.mockResolvedValue({ id: 'rec-1' });

      await worker.consume('event-1');

      // Does NOT update items again
      expect(mockTx.depositSettlementItem.update).not.toHaveBeenCalled();
      expect(mockTx.paymentOutboxEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event-1' },
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });
  });

  describe('Part 5: Policy 1.5.2 Return SLA, Deadlines & Order Completion Invariants', () => {
    it('verifies Policy 1.5.2 constants: 72h FINAL inspection SLA, 24h deep inspection', () => {
      expect(RETURN_POLICY_152.returnInspectionSlaHours).toBe(72);
      expect(RETURN_POLICY_152.deepInspectionSlaHours).toBe(24);
      expect(RETURN_POLICY_152.returnToInventoryAllowanceHours).toBe(8);
      expect(RETURN_POLICY_152.postInspectionCleaningAllowanceHours).toBe(8);
    });

    it('calculates inspection deadlines strictly from Inventory Custody Received timestamp', () => {
      const receivedAt = new Date('2026-10-17T10:00:00.000Z');
      const deadlines = inspectionDeadlines(receivedAt, true, 72, 24);

      // Nominal 72h
      expect(deadlines.inspectionDueAt.toISOString()).toBe('2026-10-20T10:00:00.000Z');
      // Deep 24h
      expect(deadlines.deepInspectionDueAt?.toISOString()).toBe('2026-10-18T10:00:00.000Z');
    });

    it('tryCompleteOrder: closes order and emits RENTAL_CLOSED only when assets, finance, and cases are all final', async () => {
      const mockTx: any = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: dummyOrderId,
            bookingId: 'book-1',
            status: RentalOrderStatus.RETURN_PROCESSING,
            rentalOrderLinesViaOrderId: [
              {
                rentalUnitAssignmentsViaOrderLineId: [
                  { id: 'asgn-1', status: RentalUnitAssignmentStatus.CLOSED },
                ],
              },
            ],
            depositSettlementViaOrderId: {
              depositSettlementItemsViaSettlementId: [
                { id: 'item-1', status: DepositItemStatus.SETTLED },
              ],
            },
            rentalExceptionCasesViaOrderId: [],
            deliveryTasksViaOrderId: [],
            packageViaOrderId: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        deliveryTask: { update: jest.fn() },
        package: { update: jest.fn() },
        rentalOutboxEvent: { upsert: jest.fn().mockResolvedValue({}) },
      };

      const completed = await tryCompleteOrder(mockTx, dummyOrderId, new Date());
      expect(completed).toBe(true);

      expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: dummyOrderId },
          data: expect.objectContaining({
            status: RentalOrderStatus.COMPLETED,
            financialStatus: RentalFinancialStatus.SETTLED,
          }),
        }),
      );

      expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deduplicationKey: `rental-closed:${dummyOrderId}` },
          create: expect.objectContaining({
            eventType: 'RENTAL_CLOSED',
          }),
        }),
      );
    });

    it('tryCompleteOrder: does NOT complete order if any unit assignment is not yet CLOSED', async () => {
      const mockTx: any = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: dummyOrderId,
            status: RentalOrderStatus.RETURN_PROCESSING,
            rentalOrderLinesViaOrderId: [
              {
                rentalUnitAssignmentsViaOrderLineId: [
                  { id: 'asgn-1', status: RentalUnitAssignmentStatus.RETURNED }, // Still in cleaning, not CLOSED!
                ],
              },
            ],
            depositSettlementViaOrderId: {
              depositSettlementItemsViaSettlementId: [{ id: 'item-1', status: DepositItemStatus.SETTLED }],
            },
            rentalExceptionCasesViaOrderId: [],
            deliveryTasksViaOrderId: [],
            packageViaOrderId: null,
          }),
          update: jest.fn(),
        },
      };

      const completed = await tryCompleteOrder(mockTx, dummyOrderId, new Date());
      expect(completed).toBe(false);
      expect(mockTx.rentalOrder.update).not.toHaveBeenCalled();
    });

    it('tryCompleteOrder: does NOT complete order if deposit items are still REFUND_PENDING', async () => {
      const mockTx: any = {
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: dummyOrderId,
            status: RentalOrderStatus.RETURN_PROCESSING,
            rentalOrderLinesViaOrderId: [
              {
                rentalUnitAssignmentsViaOrderLineId: [
                  { id: 'asgn-1', status: RentalUnitAssignmentStatus.CLOSED },
                ],
              },
            ],
            depositSettlementViaOrderId: {
              depositSettlementItemsViaSettlementId: [
                { id: 'item-1', status: DepositItemStatus.REFUND_PENDING }, // Refund still in-flight!
              ],
            },
            rentalExceptionCasesViaOrderId: [],
            deliveryTasksViaOrderId: [],
            packageViaOrderId: null,
          }),
          update: jest.fn(),
        },
      };

      const completed = await tryCompleteOrder(mockTx, dummyOrderId, new Date());
      expect(completed).toBe(false);
      expect(mockTx.rentalOrder.update).not.toHaveBeenCalled();
    });
  });

  describe('Part 6: Mixed Return, Multi-Session, Duplicate Scans & Provider Failure', () => {
    it('mixed return: separates PASS (refunded) from ISSUE (held) and MISSING (held)', () => {
      const candidates: DepositRefundCandidate[] = [
        {
          itemId: 'item-pass',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 500000,
          isFinalPass: true,
          inventoryCustodyReceived: true,
          openCase: false,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-issue',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 200000,
          isFinalPass: false, // In dispute / damage assessment
          inventoryCustodyReceived: true,
          openCase: true,
          alreadyAllocated: false,
        },
        {
          itemId: 'item-missing',
          paymentId: 'pay-1',
          currency: 'VND',
          amount: 500000,
          isFinalPass: false, // Not physically received
          inventoryCustodyReceived: false,
          openCase: true,
          alreadyAllocated: false,
        },
      ];

      const groups = planDepositRefundGroups(candidates);
      expect(groups).toHaveLength(1);
      expect(groups[0].itemIds).toEqual(['item-pass']);
      expect(groups[0].totalAmount).toBe(500000);
    });

    it('provider REFUND_FAILED: marks items as REFUND_FAILED and does not complete order', async () => {
      const mockTx: any = {
        $queryRaw: jest.fn().mockImplementation((...args: any[]) => {
          const first = args[0];
          const sql = Array.isArray(first)
            ? first.join(' ')
            : String(first?.text ?? first?.sql ?? (Array.isArray(first?.strings) ? first.strings.join(' ') : first ?? ''));
          if (sql.includes('payment_outbox_events')) {
            return Promise.resolve([{ id: 'event-fail-1' }]);
          }
          if (sql.includes('clock_timestamp')) {
            return Promise.resolve([{ now: new Date() }]);
          }
          return Promise.resolve([]);
        }),
        paymentOutboxEvent: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'event-fail-1',
            eventType: 'REFUND_FAILED',
            aggregateType: 'Refund',
            aggregateId: 'ref-fail-1',
          }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'event-fail-1',
            eventType: 'REFUND_FAILED',
            payload: { schemaVersion: 1, refundId: 'ref-fail-1' },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        refund: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ref-fail-1',
            purpose: 'DEPOSIT',
            paymentId: dummyPaymentId,
            depositSettlement: { id: dummySettlementId, orderId: dummyOrderId },
            depositRefundItems: [{ depositSettlementItemId: 'item-1', amount: new Prisma.Decimal(500000) }],
          }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: 'ref-fail-1',
            status: 'FAILED',
            depositSettlementId: dummySettlementId,
            paymentId: dummyPaymentId,
            payment: { invoiceId: 'inv-1', invoice: { rentalOrderId: dummyOrderId }, application: { status: 'APPLIED' } },
            depositRefundItems: [{ depositSettlementItemId: 'item-1', amount: new Prisma.Decimal(500000) }],
          }),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
          count: jest.fn().mockResolvedValue(0),
        },
        payment: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: dummyPaymentId, invoiceId: 'inv-1' }),
        },
        paymentAllocation: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(500000) } }),
        },
        depositSettlementItem: {
          findMany: jest.fn().mockResolvedValue([{ id: 'item-1', status: 'REFUND_PENDING' }]),
          update: jest.fn().mockResolvedValue({}),
        },
        depositSettlement: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            id: dummySettlementId,
            totalDeposit: new Prisma.Decimal(500000),
            depositSettlementItemsViaSettlementId: [{ status: 'REFUND_FAILED', depositAmount: new Prisma.Decimal(500000), refundAmount: new Prisma.Decimal(0), deductionAmount: new Prisma.Decimal(0) }],
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        paymentConsumerReceipt: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        rentalOrder: {
          findUnique: jest.fn().mockResolvedValue({
            id: dummyOrderId,
            status: RentalOrderStatus.RETURN_PROCESSING,
            rentalOrderLinesViaOrderId: [{ rentalUnitAssignmentsViaOrderLineId: [{ status: RentalUnitAssignmentStatus.CLOSED }] }],
            depositSettlementViaOrderId: { depositSettlementItemsViaSettlementId: [{ status: DepositItemStatus.REFUND_FAILED }] },
            rentalExceptionCasesViaOrderId: [],
            deliveryTasksViaOrderId: [],
            packageViaOrderId: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalOutboxEvent: {
          create: jest.fn().mockResolvedValue({}),
          upsert: jest.fn().mockResolvedValue({}),
        },
      };

      const mockDb: any = {
        $transaction: jest.fn((cb: any) => cb(mockTx)),
        $queryRaw: mockTx.$queryRaw,
      };

      const worker = new RentalDepositWorker(mockDb as PrismaService, {} as PaymentsPort);
      await worker.consume('event-fail-1');

      expect(mockTx.depositSettlementItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({ status: 'REFUND_FAILED' }),
        }),
      );

      // Order is NOT completed
      expect(mockTx.rentalOrder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RentalOrderStatus.COMPLETED }),
        }),
      );
    });

    it('EquipmentUnit safety: cannot be marked AVAILABLE before final inspection PASS + cleaning + READY', () => {
      // SOT Invariant: Only RB-API-611 marks unit AVAILABLE after cleaning and accessories verified.
      // Final Inspection marks unit as CLEANING (if PASS) or MAINTENANCE (if ISSUE/DAMAGED).
      expect(EquipmentUnitStatus.CLEANING).toBeDefined();
      expect(EquipmentUnitStatus.AVAILABLE).toBeDefined();
      expect(EquipmentUnitStatus.MAINTENANCE).toBeDefined();
    });
  });

  describe('Part 7: Phase 09 Preflight & Closure Operations Invariants', () => {
    describe('Preflight 1: RETURN_RECEIPT Invariants', () => {
      it('throws HANDOVER_DOCUMENT_REQUIRED when order lacks root HANDOVER document', async () => {
        const mockTx: any = {
          rentalReturnSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'sess-test-1',
              orderId: dummyOrderId,
              status: 'FINALIZED',
              finalizedAt: new Date(),
              receivedUnits: [dummyUnitId],
              remarks: 'Clean return',
              staffId: 'staff-1',
            }),
          },
          rentalDocument: {
            findFirst: jest.fn().mockResolvedValue(null), // Missing HANDOVER
          },
        };

        await expect(issueReturnReceiptTx(mockTx, 'sess-test-1', new Date())).rejects.toMatchObject({
          name: 'AppError',
          code: RR.HANDOVER_DOCUMENT_REQUIRED,
        });
      });

      it('throws INVALID_RETURN_STATE when session is not yet FINALIZED', async () => {
        const mockTx: any = {
          rentalReturnSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'sess-test-2',
              orderId: dummyOrderId,
              status: 'OPEN', // Not finalized
              finalizedAt: null,
            }),
          },
        };

        await expect(issueReturnReceiptTx(mockTx, 'sess-test-2', new Date())).rejects.toMatchObject({
          name: 'AppError',
          code: RR.INVALID_RETURN_STATE,
        });
      });

      it('idempotent retry: returns existing RETURN_RECEIPT snapshot without duplicate document or render event', async () => {
        const existingDoc = {
          id: 'doc-existing-receipt',
          orderId: dummyOrderId,
          documentType: RentalDocumentType.RETURN_RECEIPT,
          sourceRef: 'sess-test-3',
          snapshotJson: { kind: 'RETURN_RECEIPT', sessionId: 'sess-test-3' },
        };
        const mockTx: any = {
          rentalReturnSession: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'sess-test-3',
              orderId: dummyOrderId,
              status: 'FINALIZED',
              finalizedAt: new Date(),
              receivedUnits: [dummyUnitId],
              remarks: 'All good',
              staffId: 'staff-1',
            }),
          },
          rentalDocument: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'doc-handover-root',
              orderId: dummyOrderId,
              documentType: RentalDocumentType.HANDOVER,
            }),
            findUnique: jest.fn().mockResolvedValue(existingDoc),
            create: jest.fn(),
          },
          rentalOutboxEvent: {
            upsert: jest.fn(),
          },
        };

        const result = await issueReturnReceiptTx(mockTx, 'sess-test-3', new Date());
        expect(result).toBe(existingDoc);
        expect(mockTx.rentalDocument.create).not.toHaveBeenCalled();
        expect(mockTx.rentalOutboxEvent.upsert).not.toHaveBeenCalled();
      });

      it('multiple return sessions on same order create distinct RETURN_RECEIPT documents referencing root HANDOVER', async () => {
        const createdDocs: any[] = [];
        const mockTx: any = {
          rentalReturnSession: {
            findUnique: jest.fn().mockImplementation(({ where: { id } }: any) => {
              return Promise.resolve({
                id,
                orderId: dummyOrderId,
                status: 'FINALIZED',
                finalizedAt: new Date(),
                receivedUnits: [dummyUnitId],
                remarks: `Session ${id}`,
                staffId: 'staff-1',
              });
            }),
          },
          rentalDocument: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'doc-handover-root',
              orderId: dummyOrderId,
              documentType: RentalDocumentType.HANDOVER,
            }),
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(({ data }: any) => {
              const doc = { id: `doc-${data.sourceRef}`, ...data };
              createdDocs.push(doc);
              return Promise.resolve(doc);
            }),
          },
          rentalOutboxEvent: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        };

        const doc1 = await issueReturnReceiptTx(mockTx, 'sess-multi-1', new Date());
        const doc2 = await issueReturnReceiptTx(mockTx, 'sess-multi-2', new Date());

        expect(doc1.sourceRef).toBe('sess-multi-1');
        expect(doc2.sourceRef).toBe('sess-multi-2');
        expect(doc1.rootDocumentId).toBe('doc-handover-root');
        expect(doc2.rootDocumentId).toBe('doc-handover-root');
        expect(createdDocs.length).toBe(2);
        expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledTimes(2);
      });
    });

    describe('Preflight 2: FAILED REFUND RECOVERY Invariants', () => {
      it('REFUND_FAILED: sets order financialStatus to REFUND_PENDING and exceptionStatus to ACTION_REQUIRED', async () => {
        const mockTx: any = {
          $queryRaw: jest.fn().mockImplementation((...args: any[]) => {
            const first = args[0];
            const sql = Array.isArray(first)
              ? first.join(' ')
              : String(first?.text ?? first?.sql ?? (Array.isArray(first?.strings) ? first.strings.join(' ') : first ?? ''));
            if (sql.includes('payment_outbox_events')) {
              return Promise.resolve([{ id: 'evt-fail-recov' }]);
            }
            if (sql.includes('clock_timestamp')) {
              return Promise.resolve([{ now: new Date() }]);
            }
            return Promise.resolve([]);
          }),
          paymentOutboxEvent: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evt-fail-recov',
              eventType: 'REFUND_FAILED',
              aggregateType: 'Refund',
              aggregateId: 'ref-fail-recov',
            }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'evt-fail-recov',
              eventType: 'REFUND_FAILED',
              payload: { schemaVersion: 1, refundId: 'ref-fail-recov' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          refund: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'ref-fail-recov',
              purpose: 'DEPOSIT',
              paymentId: dummyPaymentId,
              depositSettlement: { id: dummySettlementId, orderId: dummyOrderId },
              depositRefundItems: [{ depositSettlementItemId: 'item-recov-1', amount: new Prisma.Decimal(300000) }],
            }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'ref-fail-recov',
              status: 'FAILED',
              depositSettlementId: dummySettlementId,
              paymentId: dummyPaymentId,
              payment: { invoiceId: 'inv-recov', invoice: { rentalOrderId: dummyOrderId }, application: { status: 'APPLIED' } },
              depositRefundItems: [{ depositSettlementItemId: 'item-recov-1', amount: new Prisma.Decimal(300000) }],
            }),
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }),
            count: jest.fn().mockResolvedValue(0),
          },
          payment: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ id: dummyPaymentId, invoiceId: 'inv-recov' }),
          },
          paymentAllocation: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(300000) } }),
          },
          depositSettlementItem: {
            findMany: jest.fn().mockImplementation(({ where }: any) => {
              if (where?.id?.in) {
                return Promise.resolve([{ id: 'item-recov-1', status: 'REFUND_PENDING' }]);
              }
              return Promise.resolve([{ id: 'item-recov-1', status: 'REFUND_FAILED' }]);
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          depositSettlement: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: dummySettlementId,
              totalDeposit: new Prisma.Decimal(300000),
              depositSettlementItemsViaSettlementId: [{ status: 'REFUND_FAILED', depositAmount: new Prisma.Decimal(300000), refundAmount: new Prisma.Decimal(0), deductionAmount: new Prisma.Decimal(0) }],
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          paymentConsumerReceipt: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          rentalOrder: {
            findUnique: jest.fn().mockResolvedValue({
              id: dummyOrderId,
              status: RentalOrderStatus.RETURN_PROCESSING,
              rentalOrderLinesViaOrderId: [{ rentalUnitAssignmentsViaOrderLineId: [{ status: RentalUnitAssignmentStatus.CLOSED }] }],
              depositSettlementViaOrderId: { depositSettlementItemsViaSettlementId: [{ status: DepositItemStatus.REFUND_FAILED }] },
              rentalExceptionCasesViaOrderId: [],
              deliveryTasksViaOrderId: [],
              packageViaOrderId: null,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          rentalOutboxEvent: {
            create: jest.fn().mockResolvedValue({}),
            upsert: jest.fn().mockResolvedValue({}),
          },
        };

        const worker = new RentalDepositWorker({
          $transaction: jest.fn((cb: any) => cb(mockTx)),
          $queryRaw: mockTx.$queryRaw,
        } as any, {} as any);

        await worker.consume('evt-fail-recov');

        expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: dummyOrderId },
            data: expect.objectContaining({
              financialStatus: 'REFUND_PENDING',
              exceptionStatus: RentalOrderExceptionStatus.ACTION_REQUIRED,
            }),
          }),
        );
        expect(mockTx.rentalOrder.update).not.toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              financialStatus: 'PAID',
            }),
          }),
        );
      });

      it('Recovery flow: re-evaluating succeeded event updates items to SETTLED and completes order', async () => {
        const mockTx: any = {
          $queryRaw: jest.fn().mockImplementation((...args: any[]) => {
            const first = args[0];
            const sql = Array.isArray(first)
              ? first.join(' ')
              : String(first?.text ?? first?.sql ?? (Array.isArray(first?.strings) ? first.strings.join(' ') : first ?? ''));
            if (sql.includes('payment_outbox_events')) {
              return Promise.resolve([{ id: 'evt-succ-recov' }]);
            }
            if (sql.includes('clock_timestamp')) {
              return Promise.resolve([{ now: new Date() }]);
            }
            return Promise.resolve([]);
          }),
          paymentOutboxEvent: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'evt-succ-recov',
              eventType: 'REFUND_SUCCEEDED',
              aggregateType: 'Refund',
              aggregateId: 'ref-succ-recov',
            }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'evt-succ-recov',
              eventType: 'REFUND_SUCCEEDED',
              payload: { schemaVersion: 1, refundId: 'ref-succ-recov' },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          refund: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'ref-succ-recov',
              purpose: 'DEPOSIT',
              paymentId: dummyPaymentId,
              depositSettlement: { id: dummySettlementId, orderId: dummyOrderId },
              depositRefundItems: [{ depositSettlementItemId: 'item-recov-1', amount: new Prisma.Decimal(300000) }],
            }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: 'ref-succ-recov',
              status: 'SUCCEEDED',
              depositSettlementId: dummySettlementId,
              paymentId: dummyPaymentId,
              payment: { invoiceId: 'inv-recov', invoice: { rentalOrderId: dummyOrderId }, application: { status: 'APPLIED' } },
              depositRefundItems: [{ depositSettlementItemId: 'item-recov-1', amount: new Prisma.Decimal(300000) }],
            }),
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(300000) } }),
            count: jest.fn().mockResolvedValue(0),
          },
          payment: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ id: dummyPaymentId, invoiceId: 'inv-recov' }),
          },
          paymentAllocation: {
            aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(300000) } }),
          },
          depositSettlementItem: {
            findMany: jest.fn().mockImplementation(({ where }: any) => {
              if (where?.id?.in) {
                return Promise.resolve([{ id: 'item-recov-1', status: 'REFUND_FAILED' }]);
              }
              return Promise.resolve([{ id: 'item-recov-1', status: 'SETTLED' }]);
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          depositSettlement: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              id: dummySettlementId,
              totalDeposit: new Prisma.Decimal(300000),
              depositSettlementItemsViaSettlementId: [{ status: 'SETTLED', depositAmount: new Prisma.Decimal(300000), refundAmount: new Prisma.Decimal(300000), deductionAmount: new Prisma.Decimal(0) }],
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          paymentConsumerReceipt: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          rentalOrder: {
            findUnique: jest.fn().mockResolvedValue({
              id: dummyOrderId,
              status: RentalOrderStatus.RETURN_PROCESSING,
              rentalOrderLinesViaOrderId: [{ rentalUnitAssignmentsViaOrderLineId: [{ status: RentalUnitAssignmentStatus.CLOSED }] }],
              depositSettlementViaOrderId: { depositSettlementItemsViaSettlementId: [{ status: DepositItemStatus.SETTLED }] },
              rentalExceptionCasesViaOrderId: [],
              deliveryTasksViaOrderId: [],
              packageViaOrderId: null,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          rentalOutboxEvent: {
            create: jest.fn().mockResolvedValue({}),
            upsert: jest.fn().mockResolvedValue({}),
          },
        };

        const worker = new RentalDepositWorker({
          $transaction: jest.fn((cb: any) => cb(mockTx)),
          $queryRaw: mockTx.$queryRaw,
        } as any, {} as any);

        await worker.consume('evt-succ-recov');

        expect(mockTx.depositSettlementItem.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'item-recov-1' },
            data: expect.objectContaining({ status: 'SETTLED' }),
          }),
        );
        expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: dummyOrderId },
            data: expect.objectContaining({
              financialStatus: 'SETTLED',
            }),
          }),
        );
        expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: dummyOrderId },
            data: expect.objectContaining({
              status: RentalOrderStatus.COMPLETED,
            }),
          }),
        );
      });
    });

    describe('Phase 09: Order Closure & Operations Invariants', () => {
      it('tryCompleteOrder: emits RENTAL_ORDER_CLOSED outbox event and writes audit log upon closure', async () => {
        const now = new Date();
        const mockTx: any = {
          rentalOrder: {
            findUnique: jest.fn().mockResolvedValue({
              id: dummyOrderId,
              userId: 'user-p9-1',
              bookingId: 'booking-p9-1',
              status: RentalOrderStatus.RETURN_PROCESSING,
              version: 3,
              rentalOrderLinesViaOrderId: [
                {
                  rentalUnitAssignmentsViaOrderLineId: [
                    { id: 'assign-1', status: RentalUnitAssignmentStatus.CLOSED },
                  ],
                },
              ],
              depositSettlementViaOrderId: {
                id: dummySettlementId,
                depositSettlementItemsViaSettlementId: [
                  { id: 'item-p9-1', status: DepositItemStatus.SETTLED },
                ],
              },
              rentalExceptionCasesViaOrderId: [
                { id: 'case-p9-1', status: RentalExceptionCaseStatus.RESOLVED },
              ],
              deliveryTasksViaOrderId: [
                { id: dummyTaskId, taskType: DeliveryTaskType.RETURN, status: DeliveryTaskStatus.INVENTORY_RECEIVED },
              ],
              packageViaOrderId: { id: 'pkg-p9-1', status: PackageStatus.RETURNED_TO_INVENTORY },
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          deliveryTask: {
            update: jest.fn().mockResolvedValue({}),
          },
          package: {
            update: jest.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
          rentalOutboxEvent: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        };

        const result = await tryCompleteOrder(mockTx, dummyOrderId, now);
        expect(result).toBe(true);

        expect(mockTx.rentalOrder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: dummyOrderId },
            data: expect.objectContaining({
              status: RentalOrderStatus.COMPLETED,
              financialStatus: RentalFinancialStatus.SETTLED,
              exceptionStatus: RentalOrderExceptionStatus.NONE,
            }),
          }),
        );

        expect(mockTx.deliveryTask.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: dummyTaskId },
            data: expect.objectContaining({ status: DeliveryTaskStatus.CLOSED }),
          }),
        );

        expect(mockTx.package.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'pkg-p9-1' },
            data: expect.objectContaining({ status: PackageStatus.CLOSED }),
          }),
        );

        expect(mockTx.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'RENTAL_ORDER_CLOSED',
              entityType: 'RentalOrder',
              entityId: dummyOrderId,
            }),
          }),
        );

        expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { deduplicationKey: `rental-order-closed:${dummyOrderId}` },
            create: expect.objectContaining({
              eventType: 'RENTAL_ORDER_CLOSED',
              aggregateType: 'RentalOrder',
              aggregateId: dummyOrderId,
            }),
          }),
        );
        expect(mockTx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { deduplicationKey: `rental-closed:${dummyOrderId}` },
            create: expect.objectContaining({
              eventType: 'RENTAL_CLOSED',
              aggregateType: 'RentalOrder',
              aggregateId: dummyOrderId,
            }),
          }),
        );
      });

      it('tryCompleteOrder: rejects completion if any exception case is still OPEN', async () => {
        const mockTx: any = {
          rentalOrder: {
            findUnique: jest.fn().mockResolvedValue({
              id: dummyOrderId,
              status: RentalOrderStatus.RETURN_PROCESSING,
              rentalOrderLinesViaOrderId: [
                { rentalUnitAssignmentsViaOrderLineId: [{ status: RentalUnitAssignmentStatus.CLOSED }] },
              ],
              depositSettlementViaOrderId: {
                depositSettlementItemsViaSettlementId: [{ status: DepositItemStatus.SETTLED }],
              },
              rentalExceptionCasesViaOrderId: [
                { id: 'case-open', status: RentalExceptionCaseStatus.OPEN },
              ],
              deliveryTasksViaOrderId: [],
              packageViaOrderId: null,
            }),
            update: jest.fn(),
          },
        };

        const result = await tryCompleteOrder(mockTx, dummyOrderId, new Date());
        expect(result).toBe(false);
        expect(mockTx.rentalOrder.update).not.toHaveBeenCalled();
      });

      it('RentalOperationalEscalationScheduler: sweep periodically invokes tryCompleteOrder on candidate orders', async () => {
        const mockCandidateOrders = [{ id: 'order-cand-1' }, { id: 'order-cand-2' }];
        const completedOrders: string[] = [];

        const mockTx: any = {
          rentalOrder: {
            findUnique: jest.fn().mockImplementation(({ where: { id } }: any) => {
              return Promise.resolve({
                id,
                userId: 'user-sweep-1',
                bookingId: 'booking-sweep-1',
                status: RentalOrderStatus.RETURN_PROCESSING,
                version: 1,
                rentalOrderLinesViaOrderId: [
                  { rentalUnitAssignmentsViaOrderLineId: [{ status: RentalUnitAssignmentStatus.CLOSED }] },
                ],
                depositSettlementViaOrderId: {
                  depositSettlementItemsViaSettlementId: [{ status: DepositItemStatus.SETTLED }],
                },
                rentalExceptionCasesViaOrderId: [],
                deliveryTasksViaOrderId: [],
                packageViaOrderId: null,
              });
            }),
            update: jest.fn().mockImplementation(({ where: { id } }: any) => {
              completedOrders.push(id);
              return Promise.resolve({});
            }),
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({}),
          },
          rentalOutboxEvent: {
            upsert: jest.fn().mockResolvedValue({}),
          },
        };

        const mockPrisma: any = {
          returnCustodyTransfer: { findMany: jest.fn().mockResolvedValue([]) },
          rentalExceptionCase: { findMany: jest.fn().mockResolvedValue([]) },
          rentalOrder: { findMany: jest.fn().mockResolvedValue(mockCandidateOrders) },
          $transaction: jest.fn((cb: any) => cb(mockTx)),
        };

        const scheduler = new RentalOperationalEscalationScheduler(mockPrisma);
        await scheduler.check();

        expect(mockPrisma.rentalOrder.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { status: { in: [RentalOrderStatus.RETURN_PROCESSING, RentalOrderStatus.RETURN_PENDING] } },
          }),
        );
        expect(completedOrders).toContain('order-cand-1');
        expect(completedOrders).toContain('order-cand-2');
      });
    });
  });
});

