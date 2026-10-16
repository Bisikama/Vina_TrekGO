process.env.PAYMENT_PROVIDER = 'mock';
process.env.PAYMENT_MOCK_ENABLED = 'true';
process.env.PAYMENT_MOCK_WEBHOOK_SECRET = 'mock-test-webhook-secret-not-real';
process.env.RENTAL_PICKUP_CODE_SECRET = 'mock-test-pickup-code-not-real-key';

import { Test, TestingModule } from '@nestjs/testing';
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  Interval: () => () => {},
  Timeout: () => () => {},
  SchedulerRegistry: class {},
  CronExpression: { EVERY_MINUTE: '* * * * *', EVERY_10_MINUTES: '*/10 * * * *' },
}));

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/shared/services/prisma.service';
import { SupabaseService } from 'src/shared/services/supabase.service';
import { SharedModule } from 'src/shared/shared.module';
import { IdentityModule } from 'src/modules/identity/identity.module';
import { TripsModule } from 'src/modules/trips/trips.module';
import { RentalModule } from 'src/modules/rental/rental.module';
import { PaymentsModule } from 'src/modules/payments/payments.module';
import { GlobalErrorFilter } from 'src/shared/errors/global-error.filter';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import {
  CustodyTransferStatus,
  DeliveryTaskStatus,
  DeliveryTaskType,
  EquipmentCondition,
  EquipmentUnitStatus,
  InspectionStage,
  InventoryTaskStatus,
  MediaScope,
  MediaStatus,
  PackageStatus,
  RentalOrderStatus,
  RentalUnitAssignmentStatus,
  ReturnInspectionOutcome,
  UserRole,
} from '@prisma/client';
import {
  primaryRentalInventoryLocationId,
  resolveActivePrimaryRentalLocation,
} from 'src/modules/rental/shared/primary-inventory-location';

const url = process.env.AREAB_TEST_DATABASE_URL || process.env.DATABASE_URL;

if (url) {
  const parsed = new URL(url);
  if (!parsed.pathname.includes('areab_test') && !parsed.pathname.includes('test')) {
    throw new Error('AREAB integration tests require an isolated test database.');
  }
}

const suite = url ? describe : describe.skip;

suite('Checkpoint B.1 Hotfix Regression Suite (Tasks 1 - 5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens = new Map<string, { id: string; email: string }>();
  let staffInv1Token: string;
  let staffInv2Token: string;
  let staffDel1Token: string;
  let staffDel2Token: string;
  let userToken: string;
  let adminToken: string;

  let staffInv1Id: string;
  let staffInv2Id: string;
  let staffDel1Id: string;
  let staffDel2Id: string;
  let userId: string;
  let adminId: string;

  let primaryLocationId: string;
  let foreignLocationId: string;
  let tripId: string;
  let pickupPointId: string;
  let productId: string;
  let categoryId: string;
  let runId: string;
  let mediaAssetId: string;

  beforeAll(async () => {
    runId = randomUUID().slice(0, 8);

    staffInv1Id = randomUUID();
    staffInv2Id = randomUUID();
    staffDel1Id = randomUUID();
    staffDel2Id = randomUUID();
    userId = randomUUID();
    adminId = randomUUID();

    staffInv1Token = `token-hotfix-inv1-${runId}`;
    staffInv2Token = `token-hotfix-inv2-${runId}`;
    staffDel1Token = `token-hotfix-del1-${runId}`;
    staffDel2Token = `token-hotfix-del2-${runId}`;
    userToken = `token-hotfix-user-${runId}`;
    adminToken = `token-hotfix-admin-${runId}`;

    tokens.set(staffInv1Token, { id: staffInv1Id, email: `inv1-${runId}@trekgo.test` });
    tokens.set(staffInv2Token, { id: staffInv2Id, email: `inv2-${runId}@trekgo.test` });
    tokens.set(staffDel1Token, { id: staffDel1Id, email: `del1-${runId}@trekgo.test` });
    tokens.set(staffDel2Token, { id: staffDel2Id, email: `del2-${runId}@trekgo.test` });
    tokens.set(userToken, { id: userId, email: `user-${runId}@trekgo.test` });
    tokens.set(adminToken, { id: adminId, email: `admin-${runId}@trekgo.test` });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SharedModule, IdentityModule, TripsModule, RentalModule, PaymentsModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({ verifyToken: (token: string) => Promise.resolve(tokens.get(token) || null) })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new GlobalErrorFilter());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Upsert users
    await prisma.user.upsert({
      where: { id: staffInv1Id },
      update: {},
      create: { id: staffInv1Id, email: `inv1-${runId}@trekgo.test`, fullName: 'Staff Inv 1', role: UserRole.STAFF_INVENTORY, status: 'ACTIVE', authUserId: staffInv1Id },
    });
    await prisma.user.upsert({
      where: { id: staffInv2Id },
      update: {},
      create: { id: staffInv2Id, email: `inv2-${runId}@trekgo.test`, fullName: 'Staff Inv 2', role: UserRole.STAFF_INVENTORY, status: 'ACTIVE', authUserId: staffInv2Id },
    });
    await prisma.user.upsert({
      where: { id: staffDel1Id },
      update: {},
      create: { id: staffDel1Id, email: `del1-${runId}@trekgo.test`, fullName: 'Staff Del 1', role: UserRole.STAFF_DELIVERY, status: 'ACTIVE', authUserId: staffDel1Id },
    });
    await prisma.user.upsert({
      where: { id: staffDel2Id },
      update: {},
      create: { id: staffDel2Id, email: `del2-${runId}@trekgo.test`, fullName: 'Staff Del 2', role: UserRole.STAFF_DELIVERY, status: 'ACTIVE', authUserId: staffDel2Id },
    });
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `user-${runId}@trekgo.test`, fullName: 'Hiker User', role: UserRole.USER, status: 'ACTIVE', authUserId: userId },
    });
    await prisma.user.upsert({
      where: { id: adminId },
      update: {},
      create: { id: adminId, email: `admin-${runId}@trekgo.test`, fullName: 'System Admin', role: UserRole.ADMIN, status: 'ACTIVE', authUserId: adminId },
    });

    // Primary & foreign warehouses
    const loc1 = await prisma.inventoryLocation.create({
      data: { code: `PRIM-HF-${runId}`, name: `Primary Warehouse HF ${runId}`, address: '789 Primary St', status: 'ACTIVE' },
    });
    primaryLocationId = loc1.id;
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = primaryLocationId;

    const loc2 = await prisma.inventoryLocation.create({
      data: { code: `FORG-HF-${runId}`, name: `Foreign Warehouse HF ${runId}`, address: '321 Foreign St', status: 'ACTIVE' },
    });
    foreignLocationId = loc2.id;

    // Rental policy with return allowance
    await prisma.rentalPolicy.upsert({
      where: { policyCode_versionNo: { policyCode: 'DEFAULT', versionNo: 1 } },
      update: {
        returnToInventoryAllowanceHours: 24,
      },
      create: {
        id: randomUUID(),
        policyCode: 'DEFAULT',
        versionNo: 1,
        currency: 'VND',
        dayCountMode: 'CEIL_24H',
        quoteTtlMinutes: 60,
        paymentHoldMinutes: 15,
        freeCancellationHours: 24,
        cutoffHoursBeforeTrip: 48,
        prepBufferMinutes: 0,
        returnBufferMinutes: 1440,
        cleaningBufferMinutes: 1440,
        deepInspectionBufferMinutes: 2880,
        pickupVerificationTtlMinutes: 10,
        pickupCodeTtlMinutes: 15,
        returnToInventoryAllowanceHours: 24,
        cancellationRules: [],
        effectiveFrom: new Date('2020-01-01'),
        isActive: true,
      },
    });

    // Destination & Pickup Point & Trip
    const dest = await prisma.destination.create({ data: { id: randomUUID(), name: `Dest HF ${runId}`, region: 'VN' } });
    const pup = await prisma.pickupPoint.create({
      data: { id: randomUUID(), code: `PUP-HF-${runId}`, name: `Pickup HF ${runId}`, address: 'Station 1', latitude: 10.0, longitude: 106.0, createdBy: userId },
    });
    pickupPointId = pup.id;

    const trip = await prisma.trip.create({
      data: {
        id: randomUUID(),
        leaderId: userId,
        creatorId: userId,
        destinationId: dest.id,
        pickupPointId: pup.id,
        title: `Trip HF ${runId}`,
        description: 'Trekking trip',
        status: 'OPEN',
        tripType: 'PUBLIC',
        maxPax: 10,
        startAt: new Date(Date.now() + 5 * 86400000),
        endAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    tripId = trip.id;

    await prisma.tripMember.create({ data: { tripId, userId, role: 'HOST', status: 'ACTIVE' } });

    // Category and Product
    const cat = await prisma.rentalCategory.create({ data: { name: `Hotfix Cat ${runId}`, slug: `hf-cat-${runId}` } });
    categoryId = cat.id;

    const prod = await prisma.rentalProduct.create({
      data: {
        categoryId,
        sku: `SKU-HF-${runId}`,
        name: `Tent HF ${runId}`,
        dailyPrice: 100000,
        replacementValue: 1000000,
        depositValue: 500000,
        status: 'ACTIVE',
      },
    });
    productId = prod.id;

    // Seed available units pool in primary warehouse for quote availability
    for (let i = 1; i <= 15; i++) {
      await prisma.equipmentUnit.create({
        data: {
          productId,
          homeInventoryLocationId: primaryLocationId,
          currentInventoryLocationId: primaryLocationId,
          assetCode: `UNIT-POOL-${runId}-${i}`,
          qrCode: `QR-POOL-${runId}-${i}`,
          status: EquipmentUnitStatus.AVAILABLE,
          condition: EquipmentCondition.GOOD,
        },
      });
    }

    // Seed MediaAsset
    const media = await prisma.mediaAsset.create({
      data: {
        id: randomUUID(),
        providerPublicId: `evidence-hf/${runId}`,
        secureUrl: `https://storage.trekgo.test/evidence-hf/${runId}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1024n,
        scope: MediaScope.CONDITION_EVIDENCE,
        status: MediaStatus.READY,
        ownerUserId: null,
        provider: 'CLOUDINARY',
        resourceType: 'IMAGE',
      },
    });
    mediaAssetId = media.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  // Helper to create order, lines, and task via API
  async function createOrderFixture(targetStatus: RentalOrderStatus = RentalOrderStatus.PAID) {
    const fixtureUserId = randomUUID();
    const fixtureUserToken = `token-hotfix-user-${fixtureUserId.slice(0, 8)}`;
    tokens.set(fixtureUserToken, { id: fixtureUserId, email: `user-${fixtureUserId.slice(0, 8)}@trekgo.test` });

    await prisma.user.upsert({
      where: { id: fixtureUserId },
      update: {},
      create: {
        id: fixtureUserId,
        email: `user-${fixtureUserId.slice(0, 8)}@trekgo.test`,
        fullName: 'Fixture User',
        role: UserRole.USER,
        status: 'ACTIVE',
        authUserId: fixtureUserId,
      },
    });

    await prisma.tripMember.create({
      data: { tripId, userId: fixtureUserId, role: 'MEMBER', status: 'ACTIVE' },
    });

    const quoteRes = await request(app.getHttpServer())
      .post('/api/v1/rentals/quote')
      .set('Authorization', `Bearer ${fixtureUserToken}`)
      .send({ tripId, items: [{ productId, quantity: 1 }] });
    expect(quoteRes.status).toBe(201);

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/rental-orders')
      .set('Authorization', `Bearer ${fixtureUserToken}`)
      .set('idempotency-key', randomUUID())
      .send({ quoteId: quoteRes.body.id });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.order.id;

    await prisma.rentalOrder.update({
      where: { id: orderId },
      data: { status: targetStatus },
    });

    const task = await prisma.inventoryTask.create({
      data: {
        id: randomUUID(),
        orderId,
        inventoryLocationId: primaryLocationId,
        staffId: staffInv1Id,
        status: InventoryTaskStatus.PICKING,
        startedAt: new Date(),
        version: 1,
      },
    });

    const unit = await prisma.equipmentUnit.create({
      data: {
        productId,
        homeInventoryLocationId: primaryLocationId,
        currentInventoryLocationId: primaryLocationId,
        assetCode: `UNIT-HF-${randomUUID().slice(0, 8)}`,
        qrCode: `QR-HF-${randomUUID().slice(0, 8)}`,
        status: EquipmentUnitStatus.AVAILABLE,
        condition: EquipmentCondition.GOOD,
      },
    });

    return { orderId, task, unit };
  }

  // ===========================================================================
  // TASK 1: Package / READY Safety (P0)
  // ===========================================================================
  describe('TASK 1 — Package / READY Safety (P0)', () => {
    it('should reject packing when a unit is transitioned to MAINTENANCE after pick but before PACK', async () => {
      const { task, unit } = await createOrderFixture();

      // 1. Pick the unit
      const pickRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/pick`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ assetCodes: [unit.assetCode], expectedVersion: task.version });
      expect(pickRes.status).toBe(200);

      // Verify unit status is PICKED in DB
      let unitInDb = await prisma.equipmentUnit.findUniqueOrThrow({ where: { id: unit.id } });
      expect(unitInDb.status).toBe(EquipmentUnitStatus.PICKED);

      // 2. Save pre-handover condition
      const taskV2 = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      const condRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/condition-snapshots`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          unitId: unit.id,
          condition: EquipmentCondition.GOOD,
          accessories: [],
          evidenceIds: [mediaAssetId],
          expectedVersion: taskV2.version,
        });
      expect(condRes.status).toBe(201);

      // 3. Simulate unit defect: unit transitioned to MAINTENANCE externally
      await prisma.equipmentUnit.update({
        where: { id: unit.id },
        data: { status: EquipmentUnitStatus.MAINTENANCE, condition: EquipmentCondition.DAMAGED },
      });

      // 4. Attempt to pack package with the defective unit
      const taskV3 = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      const packRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/pack`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ unitIds: [unit.id], expectedVersion: taskV3.version });

      // Must be rejected!
      expect([409, 422]).toContain(packRes.status);
      expect(['UNIT_NOT_ELIGIBLE_FOR_PICK', 'PACKAGE_INCOMPLETE']).toContain(packRes.body.error.code);

      // Invariant: Unit status must NOT be bypassed or overwritten to PACKED!
      unitInDb = await prisma.equipmentUnit.findUniqueOrThrow({ where: { id: unit.id } });
      expect(unitInDb.status).toBe(EquipmentUnitStatus.MAINTENANCE);
    });

    it('should reject markReady when a unit is transitioned to MAINTENANCE after PACK but before READY', async () => {
      const { orderId, task, unit } = await createOrderFixture();

      // Pick unit
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/pick`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ assetCodes: [unit.assetCode], expectedVersion: task.version });

      // Save condition
      const taskV2 = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/condition-snapshots`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          unitId: unit.id,
          condition: EquipmentCondition.GOOD,
          accessories: [],
          evidenceIds: [mediaAssetId],
          expectedVersion: taskV2.version,
        });

      // Pack package successfully
      const taskV3 = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      const packRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/pack`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ unitIds: [unit.id], expectedVersion: taskV3.version });
      expect(packRes.status).toBe(200);
      const pkgId = packRes.body.package.id;

      // Now unit is PACKED. Simulate sudden defect before READY
      await prisma.equipmentUnit.update({
        where: { id: unit.id },
        data: { status: EquipmentUnitStatus.MAINTENANCE, condition: EquipmentCondition.DAMAGED },
      });

      // Attempt markReady
      const taskV4 = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      const readyRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/ready`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ packageId: pkgId, expectedVersion: taskV4.version });

      expect([409, 422]).toContain(readyRes.status);

      // Order must NOT become READY_FOR_HANDOVER
      const orderInDb = await prisma.rentalOrder.findUniqueOrThrow({ where: { id: orderId } });
      expect(orderInDb.status).not.toBe(RentalOrderStatus.READY_FOR_HANDOVER);
    });
  });

  // ===========================================================================
  // TASK 2: Order Transition Safety (P0)
  // ===========================================================================
  describe('TASK 2 — Order Transition Safety (P0)', () => {
    it('should reject markReady if RentalOrder was CANCELLED during preparation', async () => {
      const { orderId, task, unit } = await createOrderFixture();

      // Pick, snapshot, pack
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/pick`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ assetCodes: [unit.assetCode], expectedVersion: task.version });

      const taskV2 = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/condition-snapshots`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ unitId: unit.id, condition: EquipmentCondition.GOOD, evidenceIds: [mediaAssetId], expectedVersion: taskV2.version });

      const taskV3 = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      const packRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/pack`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ unitIds: [unit.id], expectedVersion: taskV3.version });
      expect(packRes.status).toBe(200);
      const pkgId = packRes.body.package.id;

      // Order cancelled concurrently
      await prisma.rentalOrder.update({
        where: { id: orderId },
        data: { status: RentalOrderStatus.CANCELLED },
      });

      // Staff attempts markReady
      const taskV4 = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      const readyRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/ready`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ packageId: pkgId, expectedVersion: taskV4.version });

      expect(readyRes.status).toBe(409);
      expect(readyRes.body.error.code).toBe('INVALID_TASK_STATE');

      // Order must remain CANCELLED
      const orderInDb = await prisma.rentalOrder.findUniqueOrThrow({ where: { id: orderId } });
      expect(orderInDb.status).toBe(RentalOrderStatus.CANCELLED);
    });

    it('should reject requestTransfer if RentalOrder is not READY_FOR_HANDOVER', async () => {
      const { orderId, task } = await createOrderFixture();

      // Direct seed into READY state for task & package
      const pkg = await prisma.package.create({
        data: { orderId, packageCode: `PKG-TR-${runId}`, status: PackageStatus.READY },
      });
      await prisma.inventoryTask.update({
        where: { id: task.id },
        data: { status: InventoryTaskStatus.READY, packageId: pkg.id },
      });
      // But order was set to EXPIRED
      await prisma.rentalOrder.update({
        where: { id: orderId },
        data: { status: RentalOrderStatus.EXPIRED },
      });

      const taskInDb = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: task.id } });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/transfer-request`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ packageId: pkg.id, toStaffId: staffDel1Id, expectedVersion: taskInDb.version });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TASK_STATE');
    });
  });

  // ===========================================================================
  // TASK 3: RB-API-603 Real Contract Tests
  // ===========================================================================
  describe('TASK 3 — RB-API-603 Real Contract Tests (POST /api/v1/delivery/tasks/:id/return-to-inventory-location)', () => {
    let returnOrderId: string;
    let returnDeliveryTaskId: string;
    let returnUnit: any;
    let returnAssignment: any;

    beforeAll(async () => {
      // Create dedicated order fixture for return via API
      const retUserId = randomUUID();
      const retUserToken = `token-hotfix-ret-${retUserId.slice(0, 8)}`;
      tokens.set(retUserToken, { id: retUserId, email: `user-ret-${retUserId.slice(0, 8)}@trekgo.test` });

      await prisma.user.upsert({
        where: { id: retUserId },
        update: {},
        create: {
          id: retUserId,
          email: `user-ret-${retUserId.slice(0, 8)}@trekgo.test`,
          fullName: 'Return Hiker',
          role: UserRole.USER,
          status: 'ACTIVE',
          authUserId: retUserId,
        },
      });

      await prisma.tripMember.create({
        data: { tripId, userId: retUserId, role: 'MEMBER', status: 'ACTIVE' },
      });

      const quoteRes = await request(app.getHttpServer())
        .post('/api/v1/rentals/quote')
        .set('Authorization', `Bearer ${retUserToken}`)
        .send({ tripId, items: [{ productId, quantity: 1 }] });
      expect(quoteRes.status).toBe(201);

      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/rental-orders')
        .set('Authorization', `Bearer ${retUserToken}`)
        .set('idempotency-key', randomUUID())
        .send({ quoteId: quoteRes.body.id });
      expect(orderRes.status).toBe(201);
      returnOrderId = orderRes.body.order.id;

      const orderInDb = await prisma.rentalOrder.findUniqueOrThrow({ where: { id: returnOrderId } });
      await prisma.rentalPolicy.update({
        where: { id: orderInDb.rentalPolicyId },
        data: { returnToInventoryAllowanceHours: 24 },
      });

      await prisma.rentalOrder.update({
        where: { id: returnOrderId },
        data: { status: RentalOrderStatus.RETURN_PROCESSING },
      });

      // Associated inventoryTask at primary warehouse
      await prisma.inventoryTask.create({
        data: {
          id: randomUUID(),
          orderId: returnOrderId,
          inventoryLocationId: primaryLocationId,
          status: InventoryTaskStatus.READY,
          version: 1,
        },
      });

      // Unit in primary warehouse
      returnUnit = await prisma.equipmentUnit.create({
        data: {
          productId,
          homeInventoryLocationId: primaryLocationId,
          currentInventoryLocationId: primaryLocationId,
          assetCode: `UNIT-RET-${randomUUID().slice(0, 8)}`,
          qrCode: `QR-RET-${randomUUID().slice(0, 8)}`,
          status: EquipmentUnitStatus.RENTED,
          condition: EquipmentCondition.GOOD,
        },
      });

      // Package for order
      const pkg = await prisma.package.create({
        data: { orderId: returnOrderId, packageCode: `PKG-RET-${runId}`, status: PackageStatus.READY },
      });

      // Get order line
      const line = await prisma.rentalOrderLine.findFirstOrThrow({ where: { orderId: returnOrderId } });

      // Assignment in RETURNED status
      returnAssignment = await prisma.rentalUnitAssignment.create({
        data: {
          orderLineId: line.id,
          equipmentUnitId: returnUnit.id,
          status: RentalUnitAssignmentStatus.RETURNED,
          assignedAt: new Date(Date.now() - 3 * 86400000),
          version: 1,
        },
      });

      // Preliminary inspection for the unit
      await prisma.returnInspection.create({
        data: {
          id: randomUUID(),
          orderId: returnOrderId,
          assignmentId: returnAssignment.id,
          unitId: returnUnit.id,
          inspectorId: staffDel1Id,
          stage: InspectionStage.PRELIMINARY,
          outcome: ReturnInspectionOutcome.NORMAL,
          version: 1,
        },
      });

      // Delivery Task of type RETURN in COLLECTING state assigned to staffDel1
      const delTask = await prisma.deliveryTask.create({
        data: {
          id: randomUUID(),
          orderId: returnOrderId,
          packageId: pkg.id,
          tripId,
          servicePointId: pickupPointId,
          taskType: DeliveryTaskType.RETURN,
          status: DeliveryTaskStatus.COLLECTING,
          staffId: staffDel1Id,
          scheduledAt: new Date(),
          version: 1,
        },
      });
      returnDeliveryTaskId = delTask.id;
    });

    it('should successfully execute canonical return-to-inventory-location with HTTP 200 and return pendingTransferId', async () => {
      const delTask = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: returnDeliveryTaskId } });
      const idempKey = `idemp-ret-${randomUUID()}`;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${returnDeliveryTaskId}/return-to-inventory-location`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', idempKey)
        .send({
          unitIds: [returnUnit.id],
          expectedVersion: delTask.version,
        });

      // Assert HTTP 200 SUCCESS (NOT 400 or 422!)
      expect(res.status).toBe(200);
      expect(res.body.pendingTransferId).toBeDefined();
      expect(res.body.status).toBe('PENDING_RECEIPT');
      expect(res.body.unitIds).toEqual([returnUnit.id]);

      // Database assertions:
      const transfer = await prisma.returnCustodyTransfer.findUniqueOrThrow({
        where: { id: res.body.pendingTransferId },
      });
      expect(transfer.status).toBe(CustodyTransferStatus.PENDING_RECEIPT);
      expect(transfer.inventoryLocationId).toBe(primaryLocationId);
      expect(transfer.fromStaffId).toBe(staffDel1Id);

      // Custody has NOT automatically moved to Inventory (delivery staff still has custody)
      const unitAfter = await prisma.equipmentUnit.findUniqueOrThrow({ where: { id: returnUnit.id } });
      expect(unitAfter.status).not.toBe(EquipmentUnitStatus.AVAILABLE);

      // Boundary assertion: No FINAL inspection created
      const finalInspections = await prisma.returnInspection.findMany({
        where: { assignmentId: returnAssignment.id, stage: InspectionStage.FINAL },
      });
      expect(finalInspections.length).toBe(0);

      // Boundary assertion: No refund created from delivery
      const refunds = await prisma.refund.findMany({
        where: { payment: { invoice: { rentalOrderId: returnOrderId } } },
      });
      expect(refunds.length).toBe(0);

      // Idempotency: Re-invoking with the exact same request returns the existing pending transfer
      const reRes = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${returnDeliveryTaskId}/return-to-inventory-location`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', idempKey)
        .send({
          unitIds: [returnUnit.id],
          expectedVersion: delTask.version,
        });
      expect(reRes.status).toBe(200);
      expect(reRes.body.pendingTransferId).toBe(res.body.pendingTransferId);

      // Resuming with explicit pendingTransferId and fresh idempotency key also returns 200
      const resumeRes = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${returnDeliveryTaskId}/return-to-inventory-location`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', `idemp-resume-${randomUUID()}`)
        .send({
          unitIds: [returnUnit.id],
          pendingTransferId: res.body.pendingTransferId,
          expectedVersion: delTask.version,
        });
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.pendingTransferId).toBe(res.body.pendingTransferId);
    });

    it('verifies that removed legacy alias /return-to-warehouse is no longer exposed (404)', async () => {
      const delTask = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: returnDeliveryTaskId } });

      const legacyRes = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${returnDeliveryTaskId}/return-to-warehouse`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', `idemp-leg-${randomUUID()}`)
        .send({
          unitIds: [returnUnit.id],
          expectedVersion: delTask.version,
        });

      // Legacy alias was removed to eliminate duplicate APIs; returns 404
      expect(legacyRes.status).toBe(404);
    });

    it('should fail closed with specific error code when unit is not in RETURNED state', async () => {
      // Create a unit that is NOT marked as RETURNED
      const nonReturnedUnit = await prisma.equipmentUnit.create({
        data: {
          productId,
          homeInventoryLocationId: primaryLocationId,
          currentInventoryLocationId: primaryLocationId,
          assetCode: `UNIT-NOT-RET-${randomUUID().slice(0, 8)}`,
          qrCode: `QR-NOT-RET-${randomUUID().slice(0, 8)}`,
          status: EquipmentUnitStatus.RENTED,
          condition: EquipmentCondition.GOOD,
        },
      });

      const delTask = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: returnDeliveryTaskId } });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${returnDeliveryTaskId}/return-to-inventory-location`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          unitIds: [nonReturnedUnit.id],
          expectedVersion: delTask.version,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('UNIT_NOT_RETURNED');
    });
  });

  // ===========================================================================
  // TASK 4: Single Environment Variable
  // ===========================================================================
  describe('TASK 4 — Single Environment Variable (RENTAL_PRIMARY_INVENTORY_LOCATION_ID)', () => {
    it('returns primary ID when RENTAL_PRIMARY_INVENTORY_LOCATION_ID is valid', () => {
      expect(primaryRentalInventoryLocationId()).toBe(primaryLocationId);
    });

    it('fails closed when RENTAL_PRIMARY_INVENTORY_LOCATION_ID is missing', () => {
      const orig = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
      try {
        delete process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
        expect(() => primaryRentalInventoryLocationId()).toThrow();
      } finally {
        process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = orig;
      }
    });

    it('fails closed when only legacy RENTAL_DEFAULT_INVENTORY_LOCATION_ID is present', () => {
      const orig = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
      try {
        delete process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
        process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID = primaryLocationId;
        expect(() => primaryRentalInventoryLocationId()).toThrow();
      } finally {
        process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = orig;
        delete process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID;
      }
    });

    it('fails closed if PRIMARY points to an INACTIVE warehouse in database', async () => {
      const inactiveLoc = await prisma.inventoryLocation.create({
        data: { code: `INACT-${randomUUID().slice(0, 8)}`, name: 'Inactive WH', address: '000 Inactive', status: 'INACTIVE' },
      });
      const orig = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;
      try {
        process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = inactiveLoc.id;
        await expect(resolveActivePrimaryRentalLocation(prisma)).rejects.toThrow();
      } finally {
        process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = orig;
      }
    });
  });

  // ===========================================================================
  // TASK 5: Negative RBAC & Task Ownership Integration Tests
  // ===========================================================================
  describe('TASK 5 — Negative RBAC & Task Ownership Integration Tests', () => {
    it('rejects USER calling staff preparation claim endpoint with 403', async () => {
      const { task } = await createOrderFixture();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/claim`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('idempotency-key', randomUUID())
        .send({ expectedVersion: task.version });

      expect(res.status).toBe(403);
    });

    it('rejects USER calling delivery task claim endpoint with 403', async () => {
      const dummyId = randomUUID();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${dummyId}/claim`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('idempotency-key', randomUUID())
        .send({ expectedVersion: 1 });

      expect(res.status).toBe(403);
    });

    it('rejects STAFF_DELIVERY calling preparation pick endpoint with 403', async () => {
      const { task, unit } = await createOrderFixture();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/pick`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ assetCodes: [unit.assetCode], expectedVersion: task.version });

      expect(res.status).toBe(403);
    });

    it('rejects STAFF_INVENTORY calling delivery handover endpoint with 403', async () => {
      const dummyOrderId = randomUUID();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/handover`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ packageId: randomUUID(), verificationRef: randomUUID(), expectedVersion: 1 });

      expect(res.status).toBe(403);
    });

    it('rejects USER and STAFF_INVENTORY calling admin task assign endpoint with 403', async () => {
      const dummyTaskId = randomUUID();
      const userRes = await request(app.getHttpServer())
        .post(`/api/v1/admin/rental-tasks/${dummyTaskId}/assign`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('idempotency-key', randomUUID())
        .send({ taskType: 'WAREHOUSE', assigneeId: staffInv1Id, expectedVersion: 1 });
      expect(userRes.status).toBe(403);

      const staffRes = await request(app.getHttpServer())
        .post(`/api/v1/admin/rental-tasks/${dummyTaskId}/assign`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ taskType: 'WAREHOUSE', assigneeId: staffInv1Id, expectedVersion: 1 });
      expect(staffRes.status).toBe(403);
    });

    it('rejects staff attempting to operate on a preparation task claimed by another staff', async () => {
      // Task claimed by staffInv1
      const { task, unit } = await createOrderFixture();

      // staffInv2 attempts to pick for this task
      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${task.id}/pick`)
        .set('Authorization', `Bearer ${staffInv2Token}`)
        .set('idempotency-key', randomUUID())
        .send({ assetCodes: [unit.assetCode], expectedVersion: task.version });

      expect(res.status).toBe(403);
    });
  });
});
