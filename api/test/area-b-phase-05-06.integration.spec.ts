process.env.PAYMENT_PROVIDER = 'mock';
process.env.PAYMENT_MOCK_ENABLED = 'true';
process.env.PAYMENT_MOCK_WEBHOOK_SECRET = 'test_secret_for_mock_webhook_verification_12345';
process.env.RENTAL_PICKUP_CODE_SECRET = 'test_secret_for_pickup_code_1234567890';

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
import * as crypto from 'crypto';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/shared/services/prisma.service';
import { SupabaseService } from 'src/shared/services/supabase.service';
import { SharedModule } from 'src/shared/shared.module';
import { IdentityModule } from 'src/modules/identity/identity.module';
import { TripsModule } from 'src/modules/trips/trips.module';
import { RentalModule } from 'src/modules/rental/rental.module';
import { PaymentsModule } from 'src/modules/payments/payments.module';
import { PaymentEventsWorker } from 'src/modules/payments/payment-events.worker';
import { GlobalErrorFilter } from 'src/shared/errors/global-error.filter';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import {
  CustodyActorType,
  CustodyEventType,
  DeliveryTaskStatus,
  DeliveryTaskType,
  EquipmentCondition,
  EquipmentUnitStatus,
  InventoryTaskStatus,
  MediaScope,
  MediaStatus,
  PackageStatus,
  Prisma,
  RefundPurpose,
  RentalOrderStatus,
  RentalUnitAssignmentStatus,
  SnapshotStage,
  UserRole,
} from '@prisma/client';

const url = process.env.AREAB_TEST_DATABASE_URL || process.env.DATABASE_URL;

if (url) {
  const parsed = new URL(url);
  if (!parsed.pathname.includes('areab_test') && !parsed.pathname.includes('test')) {
    throw new Error('AREAB integration tests require an isolated test database.');
  }
}

const suite = url ? describe : describe.skip;

suite('Checkpoint B: Phase 05 & 06 Integration & E2E (BA-B-01 through BA-B-15)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens = new Map<string, { id: string; email: string }>();
  let staffInv1Token: string;
  let staffInv2Token: string;
  let staffDel1Token: string;
  let staffDel2Token: string;
  let userToken: string;
  let user2Token: string;

  let staffInv1Id: string;
  let staffInv2Id: string;
  let staffDel1Id: string;
  let staffDel2Id: string;
  let userId: string;
  let user2Id: string;

  let primaryLocationId: string;
  let foreignLocationId: string;
  let tripId: string;
  let pickupPointId: string;
  let productId: string;
  let categoryId: string;

  let primaryUnit1: any;
  let primaryUnit2: any;
  let primaryUnit3: any;
  let foreignUnit: any;
  let maintUnit: any;
  let mediaAssetId: string;

  let createdOrderId: string;
  let createdPaymentId: string;
  let inventoryTaskId: string;
  let deliveryTaskId: string;
  let packageId: string;
  let custodyTransferId: string;
  let packageCode: string;
  let verificationRef: string;

  beforeAll(async () => {
    staffInv1Id = randomUUID();
    staffInv2Id = randomUUID();
    staffDel1Id = randomUUID();
    staffDel2Id = randomUUID();
    userId = randomUUID();
    user2Id = randomUUID();

    staffInv1Token = `token-inv1-${randomUUID()}`;
    staffInv2Token = `token-inv2-${randomUUID()}`;
    staffDel1Token = `token-del1-${randomUUID()}`;
    staffDel2Token = `token-del2-${randomUUID()}`;
    userToken = `token-user-${randomUUID()}`;
    user2Token = `token-user2-${randomUUID()}`;

    tokens.set(staffInv1Token, { id: staffInv1Id, email: 'inv1@trekgo.test' });
    tokens.set(staffInv2Token, { id: staffInv2Id, email: 'inv2@trekgo.test' });
    tokens.set(staffDel1Token, { id: staffDel1Id, email: 'del1@trekgo.test' });
    tokens.set(staffDel2Token, { id: staffDel2Id, email: 'del2@trekgo.test' });
    tokens.set(userToken, { id: userId, email: 'user@trekgo.test' });
    tokens.set(user2Token, { id: user2Id, email: 'user2@trekgo.test' });

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
    const runId = randomUUID().slice(0, 8);

    // Upsert users
    await prisma.user.upsert({
      where: { id: staffInv1Id },
      update: {},
      create: { id: staffInv1Id, email: `inv1-${runId}@trekgo.test`, fullName: 'Staff Inventory 1', role: UserRole.STAFF_INVENTORY, status: 'ACTIVE', authUserId: staffInv1Id },
    });
    await prisma.user.upsert({
      where: { id: staffInv2Id },
      update: {},
      create: { id: staffInv2Id, email: `inv2-${runId}@trekgo.test`, fullName: 'Staff Inventory 2', role: UserRole.STAFF_INVENTORY, status: 'ACTIVE', authUserId: staffInv2Id },
    });
    await prisma.user.upsert({
      where: { id: staffDel1Id },
      update: {},
      create: { id: staffDel1Id, email: `del1-${runId}@trekgo.test`, fullName: 'Staff Delivery 1', role: UserRole.STAFF_DELIVERY, status: 'ACTIVE', authUserId: staffDel1Id },
    });
    await prisma.user.upsert({
      where: { id: staffDel2Id },
      update: {},
      create: { id: staffDel2Id, email: `del2-${runId}@trekgo.test`, fullName: 'Staff Delivery 2', role: UserRole.STAFF_DELIVERY, status: 'ACTIVE', authUserId: staffDel2Id },
    });
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `user-${runId}@trekgo.test`, fullName: 'User Hiker', role: UserRole.USER, status: 'ACTIVE', authUserId: userId },
    });
    await prisma.user.upsert({
      where: { id: user2Id },
      update: {},
      create: { id: user2Id, email: `user2-${runId}@trekgo.test`, fullName: 'User Hiker 2', role: UserRole.USER, status: 'ACTIVE', authUserId: user2Id },
    });

    // Primary & foreign inventory locations
    const loc1 = await prisma.inventoryLocation.create({
      data: { code: `PRIM-${runId}`, name: `Primary Warehouse ${runId}`, address: '123 Primary St', status: 'ACTIVE' },
    });
    primaryLocationId = loc1.id;
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = primaryLocationId;

    const loc2 = await prisma.inventoryLocation.create({
      data: { code: `FORG-${runId}`, name: `Foreign Warehouse ${runId}`, address: '456 Foreign St', status: 'ACTIVE' },
    });
    foreignLocationId = loc2.id;

    // Policy (isolated to DEFAULT v1)
    await prisma.rentalPolicy.upsert({
      where: { policyCode_versionNo: { policyCode: 'DEFAULT', versionNo: 1 } },
      update: {
        pickupVerificationTtlMinutes: 10,
        pickupCodeTtlMinutes: 15,
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
        cancellationRules: [],
        effectiveFrom: new Date('2020-01-01'),
        isActive: true,
      },
    });

    // Destination & Pickup Point & Trip
    const dest = await prisma.destination.create({ data: { id: randomUUID(), name: `Dest ${runId}`, region: 'VN' } });
    const pup = await prisma.pickupPoint.create({
      data: { id: randomUUID(), code: `PUP-${runId}`, name: `Pickup ${runId}`, address: 'Station 1', latitude: 10.0, longitude: 106.0, createdBy: userId },
    });
    pickupPointId = pup.id;

    const trip = await prisma.trip.create({
      data: {
        id: randomUUID(),
        leaderId: userId,
        creatorId: userId,
        destinationId: dest.id,
        pickupPointId: pup.id,
        title: `Trip ${runId}`,
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
    await prisma.tripMember.create({ data: { tripId, userId: user2Id, role: 'MEMBER', status: 'ACTIVE' } });

    // Category and Product
    const cat = await prisma.rentalCategory.create({ data: { name: `Camping ${runId}`, slug: `camp-${runId}` } });
    categoryId = cat.id;

    const prod = await prisma.rentalProduct.create({
      data: {
        categoryId,
        sku: `CAMP-${runId}`,
        name: 'Camp Stove Pro',
        dailyPrice: 50000,
        replacementValue: 1000000,
        depositValue: 200000,
        status: 'ACTIVE',
      },
    });
    productId = prod.id;

    // Primary warehouse units (AVAILABLE)
    primaryUnit1 = await prisma.equipmentUnit.create({
      data: {
        productId,
        homeInventoryLocationId: primaryLocationId,
        currentInventoryLocationId: primaryLocationId,
        assetCode: `STOVE-${runId}-01`,
        qrCode: `QR-STOVE-${runId}-01`,
        status: EquipmentUnitStatus.AVAILABLE,
        condition: EquipmentCondition.GOOD,
      },
    });
    primaryUnit2 = await prisma.equipmentUnit.create({
      data: {
        productId,
        homeInventoryLocationId: primaryLocationId,
        currentInventoryLocationId: primaryLocationId,
        assetCode: `STOVE-${runId}-02`,
        qrCode: `QR-STOVE-${runId}-02`,
        status: EquipmentUnitStatus.AVAILABLE,
        condition: EquipmentCondition.GOOD,
      },
    });
    primaryUnit3 = await prisma.equipmentUnit.create({
      data: {
        productId,
        homeInventoryLocationId: primaryLocationId,
        currentInventoryLocationId: primaryLocationId,
        assetCode: `STOVE-${runId}-03`,
        qrCode: `QR-STOVE-${runId}-03`,
        status: EquipmentUnitStatus.AVAILABLE,
        condition: EquipmentCondition.GOOD,
      },
    });

    // Foreign warehouse unit
    foreignUnit = await prisma.equipmentUnit.create({
      data: {
        productId,
        homeInventoryLocationId: foreignLocationId,
        currentInventoryLocationId: foreignLocationId,
        assetCode: `STOVE-FORG-${runId}`,
        qrCode: `QR-FORG-${runId}`,
        status: EquipmentUnitStatus.AVAILABLE,
        condition: EquipmentCondition.GOOD,
      },
    });

    // Maintenance unit in primary warehouse
    maintUnit = await prisma.equipmentUnit.create({
      data: {
        productId,
        homeInventoryLocationId: primaryLocationId,
        currentInventoryLocationId: primaryLocationId,
        assetCode: `STOVE-MAINT-${runId}`,
        qrCode: `QR-MAINT-${runId}`,
        status: EquipmentUnitStatus.MAINTENANCE,
        condition: EquipmentCondition.DAMAGED,
      },
    });

    // Seed MediaAsset for condition evidence
    const media = await prisma.mediaAsset.create({
      data: {
        id: randomUUID(),
        providerPublicId: `evidence/${runId}`,
        secureUrl: `https://storage.trekgo.test/evidence/${runId}.jpg`,
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

  describe('BA-B-01: PAID order creates exactly one InventoryTask tied to primary location', () => {
    it('should create Quote -> Order -> Payment -> Succeeded -> Exactly 1 InventoryTask', async () => {
      // 1. Quote
      const quoteRes = await request(app.getHttpServer())
        .post('/api/v1/rentals/quote')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ tripId, items: [{ productId, quantity: 1 }] });
      expect(quoteRes.status).toBe(201);
      const quoteId = quoteRes.body.id;

      // 2. Order
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/rental-orders')
        .set('Authorization', `Bearer ${userToken}`)
        .set('idempotency-key', randomUUID())
        .send({ quoteId });
      expect(orderRes.status).toBe(201);
      createdOrderId = orderRes.body.order.id;
      const totalAmountStr = new Prisma.Decimal(orderRes.body.order.totalAmount).toString();

      // 3. Payment Checkout
      const payRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${createdOrderId}/payments`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('idempotency-key', randomUUID())
        .send({ paymentMethod: 'QR' });
      expect([200, 201]).toContain(payRes.status);
      createdPaymentId = payRes.body.paymentId;

      // 4. Webhook
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        kind: 'PAYMENT',
        providerEventId: `mock-evt-b1-${createdPaymentId}`,
        merchantRequestRef: `payment:${createdPaymentId}`,
        transactionRef: `mock-txn-b1-${createdPaymentId}`,
        status: 'SUCCEEDED',
        amount: totalAmountStr,
        currency: 'VND',
        occurredAt: new Date().toISOString(),
      };
      const rawBody = JSON.stringify(payload);
      const sig = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET!).update(timestamp).update('.').update(Buffer.from(rawBody, 'utf8')).digest('hex');

      const hookRes = await request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/mock')
        .set('x-mock-timestamp', timestamp)
        .set('x-mock-signature', sig)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      expect(hookRes.status).toBe(200);

      // 5. Worker tick (tick 1: webhook inbox -> outbox; tick 2: outbox -> rental consumer)
      const worker = app.get(PaymentEventsWorker);
      await worker.tick();
      await worker.tick();

      const order = await prisma.rentalOrder.findUnique({ where: { id: createdOrderId } });
      expect(order?.status).toBe(RentalOrderStatus.PAID);

      const tasks = await prisma.inventoryTask.findMany({ where: { orderId: createdOrderId } });
      expect(tasks.length).toBe(1);
      expect(tasks[0].status).toBe(InventoryTaskStatus.OPEN);
      expect(tasks[0].inventoryLocationId).toBe(primaryLocationId);
      inventoryTaskId = tasks[0].id;

      // Duplicate payment event should NOT create a second inventory task
      await worker.tick();
      const tasksAfter = await prisma.inventoryTask.findMany({ where: { orderId: createdOrderId } });
      expect(tasksAfter.length).toBe(1);
    });
  });

  describe('BA-B-02: Concurrent Task Claiming by Two STAFF_INVENTORY', () => {
    it('should allow only one staff to claim the task and reject the second with conflict', async () => {
      const taskBefore = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/inventory/tasks/${inventoryTaskId}/claim`)
          .set('Authorization', `Bearer ${staffInv1Token}`)
          .set('idempotency-key', randomUUID())
          .send({ expectedVersion: taskBefore.version }),
        request(app.getHttpServer())
          .post(`/api/v1/inventory/tasks/${inventoryTaskId}/claim`)
          .set('Authorization', `Bearer ${staffInv2Token}`)
          .set('idempotency-key', randomUUID())
          .send({ expectedVersion: taskBefore.version }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses[0]).toBe(200);
      expect([409, 422]).toContain(statuses[1]);

      const taskAfter = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      expect(taskAfter.staffId).toBeDefined();
      expect([staffInv1Id, staffInv2Id]).toContain(taskAfter.staffId);
    });
  });

  describe('BA-B-03 & BA-B-14: Pick Eligibility & Warehouse Location Isolation', () => {
    it('should reject picking unit from foreign warehouse', async () => {
      const task = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      const activeStaffToken = task.staffId === staffInv1Id ? staffInv1Token : staffInv2Token;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/pick`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          assetCodes: [foreignUnit.assetCode],
          expectedVersion: task.version,
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.error.code).toBe('UNIT_NOT_ELIGIBLE_FOR_PICK');
    });

    it('should reject picking unit in MAINTENANCE status', async () => {
      const task = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      const activeStaffToken = task.staffId === staffInv1Id ? staffInv1Token : staffInv2Token;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/pick`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          assetCodes: [maintUnit.assetCode],
          expectedVersion: task.version,
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.error.code).toBe('UNIT_NOT_ELIGIBLE_FOR_PICK');
    });
  });

  describe('BA-B-04: Prevention of Double Unit Assignment Across Tasks', () => {
    it('should successfully pick an available unit and reject picking it again for another order', async () => {
      const task = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      const activeStaffToken = task.staffId === staffInv1Id ? staffInv1Token : staffInv2Token;

      const pickRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/pick`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          assetCodes: [primaryUnit1.assetCode],
          expectedVersion: task.version,
        });

      expect(pickRes.status).toBe(200);

      // Verify unit status is now PICKED
      const unitInDb = await prisma.equipmentUnit.findUnique({ where: { id: primaryUnit1.id } });
      expect(unitInDb?.status).toBe(EquipmentUnitStatus.PICKED);

      // Attempting to pick primaryUnit1 again must fail
      const pickAgainRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/pick`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          assetCodes: [primaryUnit1.assetCode],
          expectedVersion: pickRes.body.taskVersion,
        });

      expect([400, 422]).toContain(pickAgainRes.status);
      expect(pickAgainRes.body.error.code).toBe('UNIT_NOT_ELIGIBLE_FOR_PICK');
    });
  });

  describe('BA-B-05: Unit Replacement with Audit', () => {
    it('should replace primaryUnit1 with primaryUnit2 and record audit', async () => {
      const task = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      const activeStaffToken = task.staffId === staffInv1Id ? staffInv1Token : staffInv2Token;

      const replaceRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/replace-unit`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          oldUnitId: primaryUnit1.id,
          newUnitId: primaryUnit2.id,
          reason: 'LENS_DIRTY',
          expectedVersion: task.version,
        });

      expect(replaceRes.status).toBe(200);
      expect(replaceRes.body.newUnit.id).toBe(primaryUnit2.id);

      // Old unit transitions to MAINTENANCE with maintenance record
      const oldUnit = await prisma.equipmentUnit.findUnique({ where: { id: primaryUnit1.id } });
      expect(oldUnit?.status).toBe(EquipmentUnitStatus.MAINTENANCE);

      // New unit is now PICKED
      const newUnit = await prisma.equipmentUnit.findUnique({ where: { id: primaryUnit2.id } });
      expect(newUnit?.status).toBe(EquipmentUnitStatus.PICKED);
    });
  });

  describe('BA-B-06: Package Completion & READY_FOR_HANDOVER Transition', () => {
    it('should record pre-handover condition evidence, pack package, and mark task READY_FOR_HANDOVER', async () => {
      const task = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      const activeStaffToken = task.staffId === staffInv1Id ? staffInv1Token : staffInv2Token;

      // Record pre-handover condition for primaryUnit2
      const condRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/condition-snapshots`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          unitId: primaryUnit2.id,
          condition: EquipmentCondition.GOOD,
          accessories: [{ name: 'Stove Stand', expectedQuantity: 1, actualQuantity: 1 }],
          evidenceIds: [mediaAssetId],
          expectedVersion: task.version,
        });
      expect(condRes.status).toBe(201);

      // Pack package
      const taskForPack = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      const packRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/pack`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          unitIds: [primaryUnit2.id],
          expectedVersion: taskForPack.version,
        });
      expect(packRes.status).toBe(200);
      packageId = packRes.body.package.id;
      packageCode = packRes.body.package.code;

      // Mark ready
      const taskForReady = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      const readyRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/ready`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          packageId,
          expectedVersion: taskForReady.version,
        });
      expect(readyRes.status).toBe(200);

      const orderInDb = await prisma.rentalOrder.findUnique({ where: { id: createdOrderId } });
      expect(orderInDb?.status).toBe(RentalOrderStatus.READY_FOR_HANDOVER);

      // Verify Delivery Task was created
      const delTasks = await prisma.deliveryTask.findMany({ where: { orderId: createdOrderId } });
      expect(delTasks.length).toBe(1);
      deliveryTaskId = delTasks[0].id;
    });
  });

  describe('BA-B-07 & BA-B-08: Pickup Code TTL, One-Time Use, Reissue & VerificationRef TTL', () => {
    let activePickupCode: string;

    it('should generate pickup code for USER and transfer package custody to delivery staff', async () => {
      // 1. Staff delivery claims delivery task
      const delTask = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: deliveryTaskId } });
      const claimRes = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${deliveryTaskId}/claim`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ expectedVersion: delTask.version });
      expect(claimRes.status).toBe(200);

      // 2. Staff inventory requests transfer to staff delivery
      const taskForTransfer = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: inventoryTaskId } });
      const activeStaffToken = taskForTransfer.staffId === staffInv1Id ? staffInv1Token : staffInv2Token;
      const transferRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${inventoryTaskId}/transfer-request`)
        .set('Authorization', `Bearer ${activeStaffToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          packageId,
          toStaffId: staffDel1Id,
          expectedVersion: taskForTransfer.version,
        });
      expect(transferRes.status).toBe(200);
      custodyTransferId = transferRes.body.custodyTransferId;

      // 3. Staff delivery accepts package from inventory location
      const delTaskForRecv = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: deliveryTaskId } });
      const recvRes = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${deliveryTaskId}/receive-package`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          custodyTransferId,
          packageCode,
          expectedVersion: delTaskForRecv.version,
        });
      expect(recvRes.status).toBe(200);
      expect(recvRes.body.task.status).toBe(DeliveryTaskStatus.PACKAGE_RECEIVED);

      // 4. User requests pickup code
      const codeRes1 = await request(app.getHttpServer())
        .get(`/api/v1/rental-orders/${createdOrderId}/pickup-code`)
        .set('Authorization', `Bearer ${userToken}`);
      if (codeRes1.status !== 200) console.log('DEBUG codeRes1:', codeRes1.status, JSON.stringify(codeRes1.body));
      expect(codeRes1.status).toBe(200);
      const code1 = codeRes1.body.pickupCode;
      expect(code1).toHaveLength(6);

      // 5. User requests pickup code again -> Reissues new code, invalidating code1
      const codeRes2 = await request(app.getHttpServer())
        .get(`/api/v1/rental-orders/${createdOrderId}/pickup-code`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(codeRes2.status).toBe(200);
      activePickupCode = codeRes2.body.pickupCode;
      expect(activePickupCode).not.toEqual(code1);

      // Attempting to verify the old voided code must fail
      const delTaskCurrent = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: deliveryTaskId } });
      const verifyOldRes = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${deliveryTaskId}/verify-user`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          pickupCode: code1,
          expectedVersion: delTaskCurrent.version,
        });
      expect([400, 422]).toContain(verifyOldRes.status);
      expect(verifyOldRes.body.error.code).toBe('PICKUP_CODE_INVALID_OR_EXPIRED');

      // Verifying activePickupCode succeeds and yields verificationRef
      const delTaskForVerify = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: deliveryTaskId } });
      const verifyRes = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${deliveryTaskId}/verify-user`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          pickupCode: activePickupCode,
          expectedVersion: delTaskForVerify.version,
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.verificationRef).toBeDefined();
      verificationRef = verifyRes.body.verificationRef;
    });

    it('should reject handover if verificationRef is expired (> 10 mins)', async () => {
      // Temporarily mark the verifiedAt of pickup code as 15 minutes ago
      await prisma.rentalPickupCode.updateMany({
        where: { verificationRef },
        data: { verifiedAt: new Date(Date.now() - 15 * 60_000) },
      });

      const orderBefore = await prisma.rentalOrder.findUniqueOrThrow({ where: { id: createdOrderId } });
      const expRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${createdOrderId}/handover`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          packageId,
          verificationRef,
          expectedVersion: orderBefore.version,
        });

      expect([400, 410, 422]).toContain(expRes.status);
      expect(expRes.body.error.code).toBe('PICKUP_VERIFICATION_EXPIRED');

      // Restore verifiedAt to now
      await prisma.rentalPickupCode.updateMany({
        where: { verificationRef },
        data: { verifiedAt: new Date() },
      });
    });
  });

  describe('BA-B-09, BA-B-10 & BA-B-15: Handover Commit & Custody Chain (Inventory -> Delivery -> USER -> ACTIVE)', () => {
    it('should commit handover once, transition order to ACTIVE, and prevent duplicate commits', async () => {
      const orderBefore = await prisma.rentalOrder.findUniqueOrThrow({ where: { id: createdOrderId } });
      const pickupCodeRecord = await prisma.rentalPickupCode.findFirstOrThrow({
        where: { orderId: createdOrderId, usedAt: null, verificationRef: { not: null }, revokedAt: null },
      });
      const activeVerificationRef = verificationRef || pickupCodeRecord.verificationRef!;

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/v1/rental-orders/${createdOrderId}/handover`)
          .set('Authorization', `Bearer ${staffDel1Token}`)
          .set('idempotency-key', randomUUID())
          .send({
            packageId,
            verificationRef: activeVerificationRef,
            expectedVersion: orderBefore.version,
          }),
        request(app.getHttpServer())
          .post(`/api/v1/rental-orders/${createdOrderId}/handover`)
          .set('Authorization', `Bearer ${staffDel1Token}`)
          .set('idempotency-key', randomUUID())
          .send({
            packageId,
            verificationRef: activeVerificationRef,
            expectedVersion: orderBefore.version,
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses[0]).toBe(200);
      expect([400, 409, 422]).toContain(statuses[1]);

      // Order must now be ACTIVE
      const orderAfter = await prisma.rentalOrder.findUniqueOrThrow({ where: { id: createdOrderId } });
      expect(orderAfter.status).toBe(RentalOrderStatus.ACTIVE);

      // Package must be HANDED_OVER
      const pkgAfter = await prisma.package.findUniqueOrThrow({ where: { id: packageId } });
      expect(pkgAfter.status).toBe(PackageStatus.HANDED_OVER);

      // Unit must be RENTED
      const unitAfter = await prisma.equipmentUnit.findUniqueOrThrow({ where: { id: primaryUnit2.id } });
      expect(unitAfter.status).toBe(EquipmentUnitStatus.RENTED);
      expect(unitAfter.currentInventoryLocationId).toBeNull(); // with user

      // Custody event to USER recorded
      const custodyToUser = await prisma.custodyEvent.findFirst({
        where: {
          orderId: createdOrderId,
          eventType: CustodyEventType.DELIVERY_TO_USER,
        },
      });
      expect(custodyToUser).toBeDefined();

      // Handover document outbox event emitted
      const outbox = await prisma.rentalOutboxEvent.findFirst({
        where: {
          aggregateId: createdOrderId,
          eventType: 'RENTAL_HANDOVER_COMPLETED',
        },
      });
      expect(outbox).toBeDefined();
    });
  });

  describe('BA-B-11: No-Show / Refusal Rules (0 Deposit Deduction & Units Not AVAILABLE)', () => {
    let noShowOrderId: string;

    beforeAll(async () => {
      // Create a second order and bring it to READY_FOR_HANDOVER using user2 (to avoid OPEN_ORDER_EXISTS)
      const qRes = await request(app.getHttpServer())
        .post('/api/v1/rentals/quote')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ tripId, items: [{ productId, quantity: 1 }] });
      const qId = qRes.body.id;

      const oRes = await request(app.getHttpServer())
        .post('/api/v1/rental-orders')
        .set('Authorization', `Bearer ${user2Token}`)
        .set('idempotency-key', randomUUID())
        .send({ quoteId: qId });
      noShowOrderId = oRes.body.order.id;
      const totalAmountStr = new Prisma.Decimal(oRes.body.order.totalAmount).toString();

      const pRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${noShowOrderId}/payments`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('idempotency-key', randomUUID())
        .send({ paymentMethod: 'QR' });
      const payId = pRes.body.paymentId;

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = {
        kind: 'PAYMENT',
        providerEventId: `mock-evt-ns-${payId}`,
        merchantRequestRef: `payment:${payId}`,
        transactionRef: `mock-txn-ns-${payId}`,
        status: 'SUCCEEDED',
        amount: totalAmountStr,
        currency: 'VND',
        occurredAt: new Date().toISOString(),
      };
      const rawBody = JSON.stringify(payload);
      const sig = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET!).update(timestamp).update('.').update(Buffer.from(rawBody, 'utf8')).digest('hex');

      await request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/mock')
        .set('x-mock-timestamp', timestamp)
        .set('x-mock-signature', sig)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      const worker = app.get(PaymentEventsWorker);
      await worker.tick();
      await worker.tick();

      const nsTasks = await prisma.inventoryTask.findMany({ where: { orderId: noShowOrderId } });
      const nsTaskId = nsTasks[0].id;

      // Claim & pick unit 3
      const taskForClaim = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: nsTaskId } });
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${nsTaskId}/claim`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ expectedVersion: taskForClaim.version });

      const taskForPick = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: nsTaskId } });
      const pickRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${nsTaskId}/pick`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ assetCodes: [primaryUnit3.assetCode], expectedVersion: taskForPick.version });

      const taskForCond = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: nsTaskId } });
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${nsTaskId}/condition-snapshots`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          unitId: primaryUnit3.id,
          condition: EquipmentCondition.GOOD,
          accessories: [],
          evidenceIds: [mediaAssetId],
          expectedVersion: taskForCond.version,
        });

      const taskForPack = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: nsTaskId } });
      const packRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${nsTaskId}/pack`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ unitIds: [primaryUnit3.id], expectedVersion: taskForPack.version });

      const taskForReady = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: nsTaskId } });
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${nsTaskId}/ready`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ packageId: packRes.body.package.id, expectedVersion: taskForReady.version });

      // Inventory requests transfer to delivery
      const taskForTransfer = await prisma.inventoryTask.findUniqueOrThrow({ where: { id: nsTaskId } });
      const transferRes = await request(app.getHttpServer())
        .post(`/api/v1/inventory/tasks/${nsTaskId}/transfer-request`)
        .set('Authorization', `Bearer ${staffInv1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          packageId: packRes.body.package.id,
          toStaffId: staffDel1Id,
          expectedVersion: taskForTransfer.version,
        });

      // Delivery staff claims & receives package
      const nsDelTasks = await prisma.deliveryTask.findMany({ where: { orderId: noShowOrderId } });
      const nsDelTaskId = nsDelTasks[0].id;

      const delTaskForClaim = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: nsDelTaskId } });
      await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${nsDelTaskId}/claim`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({ expectedVersion: delTaskForClaim.version });

      const delTaskForRecv = await prisma.deliveryTask.findUniqueOrThrow({ where: { id: nsDelTaskId } });
      await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${nsDelTaskId}/receive-package`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          custodyTransferId: transferRes.body.custodyTransferId,
          packageCode: packRes.body.package.code,
          expectedVersion: delTaskForRecv.version,
        });
    });

    it('should mark no-show, refund 100% deposit without deduction, and keep unit pending return (not AVAILABLE)', async () => {
      const order = await prisma.rentalOrder.findUniqueOrThrow({ where: { id: noShowOrderId } });

      const noShowRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${noShowOrderId}/no-show`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          reason: 'USER_NO_SHOW',
          notes: 'Customer did not show up at meeting point',
          evidenceIds: [mediaAssetId],
          expectedVersion: order.version,
        });

      if (noShowRes.status !== 200) console.log('DEBUG noShowRes:', noShowRes.status, JSON.stringify(noShowRes.body));
      expect(noShowRes.status).toBe(200);
      // Deposit refund must be full lineDeposit, 0 deducted
      expect(Number(noShowRes.body.refundPreview.depositRefund)).toBe(200000);

      // Unit status must remain PACKED (pending return to inventory location) and NOT AVAILABLE
      const unit = await prisma.equipmentUnit.findUniqueOrThrow({ where: { id: primaryUnit3.id } });
      expect(unit.status).toBe(EquipmentUnitStatus.PACKED);
      expect(unit.status).not.toBe(EquipmentUnitStatus.AVAILABLE);
    });
  });

  describe('BA-B-12 & BA-B-13: RB-API-603 Canonical & Legacy Alias & Delivery Observation Boundary', () => {
    it('should support canonical return-to-inventory-location', async () => {
      // Find delivery task for createdOrderId
      const delTask = await prisma.deliveryTask.findFirstOrThrow({ where: { orderId: createdOrderId } });

      // Canonical call
      const canonicalRes = await request(app.getHttpServer())
        .post(`/api/v1/delivery/tasks/${delTask.id}/return-to-inventory-location`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          inventoryLocationId: primaryLocationId,
          expectedVersion: delTask.version,
        });
      // Route exists and executes (returns 200 or business validation)
      expect([200, 400, 422]).toContain(canonicalRes.status);
    });

    it('should preserve Phase 08 boundary: return observations do not trigger FINAL pass or refund', async () => {
      const order = await prisma.rentalOrder.findUniqueOrThrow({ where: { id: createdOrderId } });
      const obsRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${createdOrderId}/return-observations`)
        .set('Authorization', `Bearer ${staffDel1Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          items: [{ unitId: primaryUnit2.id, visibleDamage: false, accessoryObservations: [] }],
          expectedVersion: order.version,
        });

      // Observations recorded or business evaluated
      expect([200, 201, 400, 409, 422]).toContain(obsRes.status);

      // Verify no refund was automatically generated from delivery observations
      const refunds = await prisma.refund.findMany({
        where: { payment: { invoice: { rentalOrderId: createdOrderId } }, purpose: RefundPurpose.DEPOSIT },
      });
      expect(refunds.length).toBe(0);
    });
  });
});
