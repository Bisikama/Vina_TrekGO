import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../../shared/decorators/roles.decorator';
import { META_AUTH_KEY } from '../../shared/decorators/auth.decorator';
import { AuthType, REQUEST_USER_KEY } from '../../shared/constants/auth.constant';
import { GlobalErrorFilter } from '../../shared/errors';

// Controllers to verify
import { PreparationTaskController } from './preparation/presentation/controllers/preparation-task.controller';
import { DeliveryTaskController } from './delivery/presentation/controllers/delivery-task.controller';
import { RentalHandoverController } from './delivery/presentation/controllers/rental-handover.controller';
import { RentalTaskAdminController } from './delivery/presentation/controllers/rental-task-admin.controller';

// Use Cases to mock
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

describe('Rental Terminology Hotfix — REST Route Contracts & Aliases', () => {
  describe('Route & RBAC Metadata Reflection', () => {
    it('PreparationTaskController must register canonical staff/warehouse/tasks and aliases', () => {
      const paths = Reflect.getMetadata('path', PreparationTaskController);
      expect(paths).toBeDefined();
      expect(Array.isArray(paths)).toBe(true);
      const pathArray = paths as string[];

      // RB-API-301/302 SOT canonical path
      expect(pathArray).toContain('staff/warehouse/tasks');
      // 1.3.3 target path
      expect(pathArray).toContain('staff/preparation/tasks');
      // Compatibility inventory path
      expect(pathArray).toContain('inventory/tasks');

      // Check Role
      const roles = Reflect.getMetadata(ROLES_KEY, PreparationTaskController);
      expect(roles).toEqual([UserRole.STAFF_INVENTORY]);

      // Check Auth
      const auth = Reflect.getMetadata(META_AUTH_KEY, PreparationTaskController);
      expect(auth?.authTypes).toContain(AuthType.Bearer);
    });

    it('DeliveryTaskController must register canonical delivery/tasks and logistics/tasks alias', () => {
      const paths = Reflect.getMetadata('path', DeliveryTaskController);
      expect(paths).toBeDefined();
      expect(Array.isArray(paths)).toBe(true);
      const pathArray = paths as string[];

      // RB-API-401 SOT canonical path
      expect(pathArray).toContain('delivery/tasks');
      // RB-API-401 compatibility alias
      expect(pathArray).toContain('logistics/tasks');

      // Check Role
      const roles = Reflect.getMetadata(ROLES_KEY, DeliveryTaskController);
      expect(roles).toEqual([UserRole.STAFF_DELIVERY]);

      // Check Auth
      const auth = Reflect.getMetadata(META_AUTH_KEY, DeliveryTaskController);
      expect(auth?.authTypes).toContain(AuthType.Bearer);
    });

    it('RentalTaskAdminController and RentalHandoverController roles must be configured correctly', () => {
      const assignMethod = Object.getOwnPropertyDescriptor(
        RentalTaskAdminController.prototype,
        'assign',
      )?.value;
      const adminRoles = Reflect.getMetadata(ROLES_KEY, assignMethod);
      expect(adminRoles).toEqual([UserRole.ADMIN]);

      const handoverMethod = Object.getOwnPropertyDescriptor(
        RentalHandoverController.prototype,
        'handover',
      )?.value;
      const handoverRoles = Reflect.getMetadata(ROLES_KEY, handoverMethod);
      expect(handoverRoles).toEqual([UserRole.STAFF_DELIVERY]);
    });
  });

  describe('HTTP Route Endpoints & Status Verification (Supertest)', () => {
    let app: INestApplication;

    const dummyTaskId = '11111111-1111-4111-8111-111111111111';
    const dummyPackageId = '660e8400-e29b-41d4-a716-446655440002';
    const dummyDeliveryTaskId = '22222222-2222-4222-8222-222222222222';

    const mockPreparationList = {
      items: [
        {
          id: dummyTaskId,
          orderId: '33333333-3333-4333-8333-333333333333',
          status: 'PENDING',
          items: [],
          totalUnitsRequired: 2,
          totalUnitsPicked: 0,
          deadline: null,
          staffId: null,
          version: 1,
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    };

    const mockPreparationDetail = {
      task: {
        id: dummyTaskId,
        orderId: '33333333-3333-4333-8333-333333333333',
        status: 'PENDING',
        items: [],
        packages: [],
        version: 1,
      },
    };

    const mockPreparationReady = {
      taskId: dummyTaskId,
      taskStatus: 'READY_FOR_HANDOVER',
      orderStatus: 'READY_FOR_HANDOVER',
      deliveryTaskId: dummyDeliveryTaskId,
      logisticsTaskId: dummyDeliveryTaskId,
      version: 2,
    };

    const mockDeliveryList = {
      items: [
        {
          id: dummyDeliveryTaskId,
          taskType: 'OUTBOUND',
          status: 'SCHEDULED',
          scheduledAt: '2026-10-17T08:00:00.000Z',
          orderId: '33333333-3333-4333-8333-333333333333',
          servicePointId: '44444444-4444-4444-8444-444444444444',
          version: 1,
        },
      ],
      pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
    };

    const mockDeliveryDetail = {
      id: dummyDeliveryTaskId,
      taskType: 'OUTBOUND',
      status: 'SCHEDULED',
      version: 1,
    };

    const mockDeliveryClaim = {
      taskId: dummyDeliveryTaskId,
      status: 'ASSIGNED',
      staffId: '55555555-5555-4555-8555-555555555555',
      version: 2,
    };

    beforeAll(async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [PreparationTaskController, DeliveryTaskController],
        providers: [
          // Preparation use cases
          {
            provide: ListPreparationTasksUseCase,
            useValue: { execute: jest.fn().mockResolvedValue(mockPreparationList) },
          },
          {
            provide: GetPreparationTaskUseCase,
            useValue: { execute: jest.fn().mockResolvedValue(mockPreparationDetail) },
          },
          { provide: PickPreparationUnitsUseCase, useValue: { execute: jest.fn() } },
          { provide: SavePreHandoverConditionUseCase, useValue: { execute: jest.fn() } },
          { provide: PackPreparationPackageUseCase, useValue: { execute: jest.fn() } },
          {
            provide: MarkPreparationReadyUseCase,
            useValue: { execute: jest.fn().mockResolvedValue(mockPreparationReady) },
          },
          { provide: ReplacePreparationUnitUseCase, useValue: { execute: jest.fn() } },
          { provide: ClaimPreparationTaskUseCase, useValue: { execute: jest.fn() } },
          { provide: RequestPreparationTransferUseCase, useValue: { execute: jest.fn() } },
          { provide: ListReplacementCandidatesUseCase, useValue: { execute: jest.fn() } },
          { provide: ListPickCandidatesUseCase, useValue: { execute: jest.fn() } },

          // Delivery use cases
          {
            provide: ListDeliveryTasksUseCase,
            useValue: { execute: jest.fn().mockResolvedValue(mockDeliveryList) },
          },
          {
            provide: GetDeliveryTaskUseCase,
            useValue: { execute: jest.fn().mockResolvedValue(mockDeliveryDetail) },
          },
          {
            provide: ClaimDeliveryTaskUseCase,
            useValue: { execute: jest.fn().mockResolvedValue(mockDeliveryClaim) },
          },
          { provide: ReceivePackageUseCase, useValue: { execute: jest.fn() } },
          { provide: VerifyRentalRecipientUseCase, useValue: { execute: jest.fn() } },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalFilters(new GlobalErrorFilter());

      // Mock user context injection so controller handler executes without full auth chain
      app.use((req: any, _res: any, next: () => void) => {
        req[REQUEST_USER_KEY] = {
          id: '55555555-5555-4555-8555-555555555555',
          role: req.headers['x-mock-role'] ?? UserRole.STAFF_INVENTORY,
          status: 'ACTIVE',
        };
        next();
      });

      await app.init();
    });

    afterAll(async () => {
      if (app) await app.close();
    });

    // -------------------------------------------------------------------------
    // RB-API-301 / RB-API-302 / RB-API-306 Route verification
    // -------------------------------------------------------------------------
    describe('Preparation Routes (RB-API-301, 302, 306)', () => {
      it('RB-API-301: GET /api/v1/staff/warehouse/tasks (Canonical SOT) responds 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/staff/warehouse/tasks')
          .set('x-mock-role', UserRole.STAFF_INVENTORY)
          .expect(200);

        expect(res.body.items).toBeDefined();
        expect(res.body.items).toHaveLength(1);
        expect(res.body.pagination).toBeDefined();
      });

      it('RB-API-301 Target alias: GET /api/v1/staff/preparation/tasks responds 200 with identical data', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/staff/preparation/tasks')
          .set('x-mock-role', UserRole.STAFF_INVENTORY)
          .expect(200);

        expect(res.body.items).toBeDefined();
        expect(res.body.items[0].id).toBe(dummyTaskId);
      });

      it('RB-API-301 Inventory alias: GET /api/v1/inventory/tasks responds 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/inventory/tasks')
          .set('x-mock-role', UserRole.STAFF_INVENTORY)
          .expect(200);

        expect(res.body.items).toBeDefined();
        expect(res.body.items[0].id).toBe(dummyTaskId);
      });

      it('RB-API-302: GET /api/v1/staff/warehouse/tasks/:id (Canonical SOT) responds 200', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/staff/warehouse/tasks/${dummyTaskId}`)
          .set('x-mock-role', UserRole.STAFF_INVENTORY)
          .expect(200);

        expect(res.body.task).toBeDefined();
        expect(res.body.task.id).toBe(dummyTaskId);
      });

      it('RB-API-302 Target alias: GET /api/v1/staff/preparation/tasks/:id responds 200', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/staff/preparation/tasks/${dummyTaskId}`)
          .set('x-mock-role', UserRole.STAFF_INVENTORY)
          .expect(200);

        expect(res.body.task).toBeDefined();
        expect(res.body.task.id).toBe(dummyTaskId);
      });

      it('RB-API-306 Canonical: POST /api/v1/staff/preparation/tasks/:id/ready responds 200 with deliveryTaskId & logisticsTaskId', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/staff/preparation/tasks/${dummyTaskId}/ready`)
          .set('x-mock-role', UserRole.STAFF_INVENTORY)
          .set('idempotency-key', 'ready-idempotency-key-01')
          .send({ packageId: dummyPackageId, expectedVersion: 1 })
          .expect(200);

        expect(res.body.taskId).toBe(dummyTaskId);
        expect(res.body.taskStatus).toBe('READY_FOR_HANDOVER');
        expect(res.body.deliveryTaskId).toBe(dummyDeliveryTaskId);
        expect(res.body.logisticsTaskId).toBe(dummyDeliveryTaskId);
      });

      it('RB-API-306 Legacy alias: POST /api/v1/staff/warehouse/tasks/:id/ready responds 200', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/staff/warehouse/tasks/${dummyTaskId}/ready`)
          .set('x-mock-role', UserRole.STAFF_INVENTORY)
          .set('idempotency-key', 'ready-idempotency-key-02')
          .send({ packageId: dummyPackageId, expectedVersion: 1 })
          .expect(200);

        expect(res.body.taskId).toBe(dummyTaskId);
        expect(res.body.deliveryTaskId).toBe(dummyDeliveryTaskId);
      });
    });

    // -------------------------------------------------------------------------
    // RB-API-401 / RB-API-402 / RB-API-407 Route verification
    // -------------------------------------------------------------------------
    describe('Delivery Routes (RB-API-401, 402, 407)', () => {
      it('RB-API-401 Canonical: GET /api/v1/delivery/tasks responds 200', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/delivery/tasks')
          .set('x-mock-role', UserRole.STAFF_DELIVERY)
          .expect(200);

        expect(res.body.items).toBeDefined();
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].id).toBe(dummyDeliveryTaskId);
      });

      it('RB-API-401 Compatibility alias: GET /api/v1/logistics/tasks responds 200 with identical data', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/logistics/tasks')
          .set('x-mock-role', UserRole.STAFF_DELIVERY)
          .expect(200);

        expect(res.body.items).toBeDefined();
        expect(res.body.items[0].id).toBe(dummyDeliveryTaskId);
      });

      it('RB-API-402 Canonical: GET /api/v1/delivery/tasks/:id responds 200', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/delivery/tasks/${dummyDeliveryTaskId}`)
          .set('x-mock-role', UserRole.STAFF_DELIVERY)
          .expect(200);

        expect(res.body.id).toBe(dummyDeliveryTaskId);
      });

      it('RB-API-402 Alias: GET /api/v1/logistics/tasks/:id responds 200', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/logistics/tasks/${dummyDeliveryTaskId}`)
          .set('x-mock-role', UserRole.STAFF_DELIVERY)
          .expect(200);

        expect(res.body.id).toBe(dummyDeliveryTaskId);
      });

      it('RB-API-407 Canonical: POST /api/v1/delivery/tasks/:id/claim responds 200', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/delivery/tasks/${dummyDeliveryTaskId}/claim`)
          .set('x-mock-role', UserRole.STAFF_DELIVERY)
          .set('idempotency-key', 'claim-idempotency-key-01')
          .send({ expectedVersion: 1 })
          .expect(200);

        expect(res.body.taskId).toBe(dummyDeliveryTaskId);
        expect(res.body.status).toBe('ASSIGNED');
      });

      it('RB-API-407 Alias: POST /api/v1/logistics/tasks/:id/claim responds 200', async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/logistics/tasks/${dummyDeliveryTaskId}/claim`)
          .set('x-mock-role', UserRole.STAFF_DELIVERY)
          .set('idempotency-key', 'claim-idempotency-key-02')
          .send({ expectedVersion: 1 })
          .expect(200);

        expect(res.body.taskId).toBe(dummyDeliveryTaskId);
        expect(res.body.status).toBe('ASSIGNED');
      });
    });
  });
});
