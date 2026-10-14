process.env.PAYMENT_PROVIDER = 'mock';
process.env.PAYMENT_MOCK_ENABLED = 'true';
process.env.PAYMENT_MOCK_WEBHOOK_SECRET = 'test_secret_for_mock_webhook_verification_12345';

import { Test, TestingModule } from '@nestjs/testing';
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  Interval: () => () => {},
  Timeout: () => () => {},
  SchedulerRegistry: class {},
  CronExpression: { EVERY_MINUTE: '* * * * *', EVERY_10_MINUTES: '*/10 * * * *' },
}));
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { PaymentEventsWorker } from 'src/modules/payments/payment-events.worker';
import { TechnicalReversalWorker } from 'src/modules/payments/technical-reversal.worker';
import { PrismaService } from 'src/shared/services/prisma.service';
import { SupabaseService } from 'src/shared/services/supabase.service';
import { SharedModule } from 'src/shared/shared.module';
import { IdentityModule } from 'src/modules/identity/identity.module';
import { TripsModule } from 'src/modules/trips/trips.module';
import { RentalModule } from 'src/modules/rental/rental.module';
import { PaymentsModule } from 'src/modules/payments/payments.module';
import { randomUUID } from 'node:crypto';
import { GlobalErrorFilter } from 'src/shared/errors/global-error.filter';
import { ZodValidationPipe } from 'src/shared/pipes/zod-validation.pipe';
import { getVerifiedCapacitySnapshot } from 'src/modules/rental/ordering/infrastructure/adapters/rental-capacity-snapshot';
import { PrismaRentalAvailabilityAdapter } from 'src/modules/rental/ordering/infrastructure/adapters/prisma-rental-availability.adapter';

describe('Phase 00-04 End-to-End Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let user2Token: string;
  
  const tokens = new Map<string, { id: string; email: string }>();
  let tripId: string;
  let productId: string;
  let locationId: string;
  const equipmentUnits: any[] = [];
  let userId1: string;
  let userId2: string;
  let quoteId: string;
  let orderId: string;
  let paymentIdVal: string;


  beforeAll(async () => {
    // We assume DATABASE_URL is set in the environment when running this test.
    const url = process.env.DATABASE_URL;
    if (!url || (!url.includes('areab_test') && !url.includes('test'))) {
      throw new Error('DATABASE_URL must be set and contain "areab_test" or "test" to run this suite.');
    }

    userId1 = randomUUID();
    userId2 = randomUUID();
    userToken = randomUUID();
    user2Token = randomUUID();
    tokens.set(userToken, { id: userId1, email: 'test1@example.com' });
    tokens.set(user2Token, { id: userId2, email: 'test2@example.com' });

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

    // Create test users
    await prisma.user.upsert({
      where: { id: userId1 },
      update: {},
      create: { id: userId1, email: `test1-${userId1.slice(0, 8)}@example.com`, fullName: 'Test 1', role: 'USER', status: 'ACTIVE', authUserId: userId1 },
    });
    await prisma.user.upsert({
      where: { id: userId2 },
      update: {},
      create: { id: userId2, email: `test2-${userId2.slice(0, 8)}@example.com`, fullName: 'Test 2', role: 'USER', status: 'ACTIVE', authUserId: userId2 },
    });

    await prisma.rentalPolicy.upsert({
      where: {
        policyCode_versionNo: {
          policyCode: 'DEFAULT',
          versionNo: 1,
        },
      },
      update: {},
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
        cancellationRules: [],
        effectiveFrom: new Date('2020-01-01'),
        isActive: true,
      },
    });

    // Create a trip
    const destination = await prisma.destination.create({
      data: { id: randomUUID(), name: `Test Dest ${runId}`, region: 'VN' }
    });

    const pickup = await prisma.pickupPoint.create({
      data: {
        id: randomUUID(),
        code: `PUP-${runId}`,
        name: `Test Pickup ${runId}`,
        address: '123 Main St',
        latitude: 10.0,
        longitude: 106.0,
        createdBy: userId1,
      }
    });

    const trip = await prisma.trip.create({
      data: {
        id: randomUUID(),
        leaderId: userId1,
        creatorId: userId1,
        destinationId: destination.id,
        pickupPointId: pickup.id,
        title: `Test Trip ${runId}`,
        description: 'Test',
        status: 'OPEN',
        tripType: 'PUBLIC',
        maxPax: 10,
        startAt: new Date(Date.now() + 10 * 86400000), // 10 days from now
        endAt: new Date(Date.now() + 12 * 86400000),
      },
    });
    tripId = trip.id;

    // Add members
    await prisma.tripMember.create({
      data: { tripId, userId: userId1, role: 'HOST', status: 'ACTIVE' },
    });
    await prisma.tripMember.create({
      data: { tripId, userId: userId2, role: 'MEMBER', status: 'ACTIVE' },
    });

    // Inventory location
    const loc = await prisma.inventoryLocation.create({
      data: { code: `WH-${runId}`, name: `Main Warehouse ${runId}`, address: '123 Main St', status: 'ACTIVE' },
    });
    locationId = loc.id;
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = locationId;

    // Category and Product
    const cat = await prisma.rentalCategory.create({
      data: { name: `Tents ${runId}`, slug: `tents-${runId}` },
    });
    const prod = await prisma.rentalProduct.create({
      data: {
        categoryId: cat.id,
        sku: `TENT-${runId}`,
        name: '2-person Tent',
        dailyPrice: 100000,
        replacementValue: 2000000,
        depositValue: 500000,
        status: 'ACTIVE',
      },
    });
    productId = prod.id;

    // Add 2 equipment units
    for (let i = 0; i < 2; i++) {
      equipmentUnits.push(await prisma.equipmentUnit.create({
        data: {
          productId,
          homeInventoryLocationId: locationId,
          currentInventoryLocationId: locationId,
          assetCode: `TENT-${runId}-${i}`,
          qrCode: `QR-TENT-${runId}-${i}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
        }
      }));
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Happy Path: Trip Membership -> Catalog -> Availability -> Quote -> Order -> Payment -> Inventory', () => {
    it('should create quote', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rentals/quote`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          tripId,
          items: [{ productId, quantity: 1 }],
        });

      if (res.status !== 201) {
        console.log('Quote Error:', res.body);
      }
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      quoteId = res.body.id;
    });

    it('should checkout and create rental order', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('idempotency-key', randomUUID())
        .send({ quoteId });

      expect(res.status).toBe(201);
      expect(res.body.order.id).toBeDefined();
      orderId = res.body.order.id;

      // Verify QuantityReservation
      const resCount = await prisma.rentalQuantityReservation.count({
        where: { orderLine: { orderId: orderId } }
      });
      expect(resCount).toBe(1);
    });


    it('should create payment checkout', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${orderId}/payments`)
        .set('Authorization', `Bearer ${userToken}`)
        .set('idempotency-key', randomUUID())
        .send({
          paymentMethod: 'QR'
        });

      if (![200, 201].includes(res.status)) console.log('Payment Checkout Error:', res.body);
      else console.log('Payment Checkout Success:', res.body);
      expect([200, 201]).toContain(res.status);
      expect(res.body.paymentId).toBeDefined();
      paymentIdVal = res.body.paymentId;
    });

    it('should process payment webhook success and verify final state', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payloadObj = {
          kind: 'PAYMENT',
          providerEventId: 'mock-evt-' + paymentIdVal,
          merchantRequestRef: 'payment:' + paymentIdVal,
          transactionRef: 'mock-txn-' + paymentIdVal,
          status: 'SUCCEEDED',
          amount: '700000',
          currency: 'VND',
          occurredAt: new Date().toISOString()
      };
      const rawBodyStr = JSON.stringify(payloadObj);
      const sig = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET!).update(timestamp).update('.').update(Buffer.from(rawBodyStr, 'utf8')).digest('hex');

      const hookRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/webhooks/mock`)
        .set('x-mock-timestamp', timestamp)
        .set('x-mock-signature', sig)
        .set('Content-Type', 'application/json')
        .send(rawBodyStr);

      if (hookRes.status !== 200) {
        console.error('Webhook Error:', hookRes.body);
      }
      expect(hookRes.status).toBe(200);

      // Process webhook manually
      const worker = app.get(PaymentEventsWorker);
      await worker.tick();

      const payment = await prisma.payment.findUnique({ where: { id: paymentIdVal } });
      const webhookEvents = await prisma.paymentWebhookEvent.findMany();
      console.log('Payment:', payment);
      console.log('WebhookEvents:', webhookEvents);

      expect(payment?.status).toBe('SUCCEEDED');

      const order = await prisma.rentalOrder.findUnique({ where: { id: orderId } });
      expect(order?.status).toBe('PAID');

      // Check Inventory Task
      const tasks = await prisma.inventoryTask.findMany({ where: { orderId: orderId } });
      expect(tasks.length).toBe(1);
      expect(tasks[0].status).toBe('OPEN');
    });
  });

  describe('Error Cases', () => {
    it('should rollback when attempting to overbook (Capacity Lost)', async () => {
      // Since total capacity is 2, and 1 is already taken by user 1, user 2 can take 1. Let's try 2 to overbook.
      const quoteRes = await request(app.getHttpServer())
        .post(`/api/v1/rentals/quote`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          tripId,
          items: [{ productId, quantity: 2 }],
        });
      
      expect(quoteRes.status).toBe(400);
      expect(quoteRes.body.error.code).toBe('INSUFFICIENT_AVAILABLE_QUANTITY');
    });

    it('should reject checkout if Quote expired', async () => {
      const quoteRes = await request(app.getHttpServer())
        .post(`/api/v1/rentals/quote`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          tripId,
          items: [{ productId, quantity: 1 }],
        });
      
      const qId = quoteRes.body.id;
      await prisma.rentalQuote.update({ where: { id: qId }, data: { status: 'EXPIRED' } });

      const checkoutRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('idempotency-key', randomUUID())
        .send({ quoteId: qId });

      if (checkoutRes.status !== 400) console.log('Checkout expected 400 got:', checkoutRes.body);
      expect(checkoutRes.status).toBe(400);
      expect(checkoutRes.body.error.code).toBe('QUOTE_NOT_ACTIVE');
    });

    it('should release hold and technical reverse payment if payment is late (System fault)', async () => {
      const quoteRes = await request(app.getHttpServer())
        .post(`/api/v1/rentals/quote`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          tripId,
          items: [{ productId, quantity: 1 }],
        });
      const qId = quoteRes.body.id;

      const checkoutRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('idempotency-key', randomUUID())
        .send({ quoteId: qId });
      
      expect(checkoutRes.status).toBe(201);
      const user2OrderId = checkoutRes.body.order.id;

      const payRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${user2OrderId}/payments`)
        .set('Authorization', `Bearer ${user2Token}`)
        .set('idempotency-key', randomUUID())
        .send({
          paymentMethod: 'QR'
        });
      const payId = payRes.body.paymentId;

      // Mark the rental order as EXPIRED
      await prisma.rentalOrder.update({
        where: { id: user2OrderId },
        data: { status: 'EXPIRED' },
      });
      // also release reservation
      await prisma.rentalQuantityReservation.updateMany({
        where: { orderLine: { orderId: user2OrderId } },
        data: { status: 'RELEASED' },
      });

      const timestampLate = Math.floor(Date.now() / 1000).toString();
      const payloadObjLate = {
          kind: 'PAYMENT',
          providerEventId: 'mock-evt-late-' + payId,
          merchantRequestRef: 'payment:' + payId,
          transactionRef: 'mock-txn-late-' + payId,
          status: 'SUCCEEDED',
          amount: '700000',
          currency: 'VND',
          occurredAt: new Date().toISOString()
      };
      const rawBodyStrLate = JSON.stringify(payloadObjLate);
      const sigLate = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET!).update(timestampLate).update('.').update(Buffer.from(rawBodyStrLate, 'utf8')).digest('hex');

      const hookRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/webhooks/mock`)
        .set('x-mock-timestamp', timestampLate)
        .set('x-mock-signature', sigLate)
        .set('Content-Type', 'application/json')
        .send(rawBodyStrLate);

      expect(hookRes.status).toBe(200);
      
      // Process webhook manually
      const worker = app.get(PaymentEventsWorker);
      await worker.tick();
      const trWorker = app.get(TechnicalReversalWorker);
      await trWorker.tick();

      const dbPayment = await prisma.payment.findUnique({
        where: { id: payId },
      });
      expect(dbPayment?.status).toBe('SUCCEEDED'); // The payment succeeded at provider level
      
      const appRecord = await prisma.paymentApplication.findFirst({
        where: { paymentId: payId }
      });
      expect(appRecord?.status).toBe('REJECTED'); // rejected application due to expired order
      
      const refunds = await prisma.refund.findMany({ where: { paymentId: payId } });
      expect(refunds.length).toBeGreaterThan(0);
      expect(refunds[0].purpose).toBe('TECHNICAL_REVERSAL');
    });

    it('should prevent duplicate webhook processing', async () => {
      const timestampDup = Math.floor(Date.now() / 1000).toString();
      const payloadObjDup = {
          kind: 'PAYMENT',
          providerEventId: 'mock-evt-' + paymentIdVal,
          merchantRequestRef: 'payment:' + paymentIdVal,
          transactionRef: 'mock-txn-' + paymentIdVal,
          status: 'SUCCEEDED',
          amount: '700000',
          currency: 'VND',
          occurredAt: new Date().toISOString()
      };
      const rawBodyStrDup = JSON.stringify(payloadObjDup);
      const sigDup = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET!).update(timestampDup).update('.').update(Buffer.from(rawBodyStrDup, 'utf8')).digest('hex');

      const hookRes = await request(app.getHttpServer())
        .post(`/api/v1/payments/webhooks/mock`)
        .set('x-mock-timestamp', timestampDup)
        .set('x-mock-signature', sigDup)
        .set('Content-Type', 'application/json')
        .send(rawBodyStrDup);
      
      expect(hookRes.status).toBe(200);
      
      // Process webhook manually
      const worker = app.get(PaymentEventsWorker);
      await worker.tick();

      const tasks = await prisma.inventoryTask.findMany({ where: { orderId: orderId } });
      expect(tasks.length).toBe(1);
    });

    it('should safely serialize two concurrent orders requesting the last available quantity', async () => {
      const uAId = randomUUID();
      const uBId = randomUUID();
      const uAToken = randomUUID();
      const uBToken = randomUUID();
      tokens.set(uAToken, { id: uAId, email: `uA-${uAId.slice(0, 8)}@example.com` });
      tokens.set(uBToken, { id: uBId, email: `uB-${uBId.slice(0, 8)}@example.com` });
      await prisma.user.create({
        data: { id: uAId, authUserId: uAId, email: `uA-${uAId.slice(0, 8)}@example.com`, fullName: 'UA', role: 'USER', status: 'ACTIVE' },
      });
      await prisma.user.create({
        data: { id: uBId, authUserId: uBId, email: `uB-${uBId.slice(0, 8)}@example.com`, fullName: 'UB', role: 'USER', status: 'ACTIVE' },
      });
      await prisma.tripMember.create({ data: { tripId, userId: uAId, role: 'MEMBER', status: 'ACTIVE' } });
      await prisma.tripMember.create({ data: { tripId, userId: uBId, role: 'MEMBER', status: 'ACTIVE' } });

      const singleProd = await prisma.rentalProduct.create({
        data: {
          categoryId: (await prisma.rentalCategory.findFirst())!.id,
          sku: `CONCUR-${randomUUID().slice(0, 8)}`,
          name: 'Concurrent Tent',
          dailyPrice: 100000,
          replacementValue: 2000000,
          depositValue: 500000,
          status: 'ACTIVE',
        },
      });
      await prisma.equipmentUnit.create({
        data: {
          productId: singleProd.id,
          homeInventoryLocationId: locationId,
          currentInventoryLocationId: locationId,
          assetCode: `CONCUR-U-${randomUUID().slice(0, 8)}`,
          qrCode: `QR-CONCUR-${randomUUID().slice(0, 8)}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
        },
      });

      const qRes1 = await request(app.getHttpServer())
        .post('/api/v1/rentals/quote')
        .set('Authorization', `Bearer ${uAToken}`)
        .send({ tripId, items: [{ productId: singleProd.id, quantity: 1 }] });
      const qRes2 = await request(app.getHttpServer())
        .post('/api/v1/rentals/quote')
        .set('Authorization', `Bearer ${uBToken}`)
        .send({ tripId, items: [{ productId: singleProd.id, quantity: 1 }] });

      expect(qRes1.status).toBe(201);
      expect(qRes2.status).toBe(201);

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/rental-orders')
          .set('Authorization', `Bearer ${uAToken}`)
          .set('idempotency-key', randomUUID())
          .send({ quoteId: qRes1.body.id }),
        request(app.getHttpServer())
          .post('/api/v1/rental-orders')
          .set('Authorization', `Bearer ${uBToken}`)
          .set('idempotency-key', randomUUID())
          .send({ quoteId: qRes2.body.id }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([201, 400]);

      const failedRes = res1.status === 400 ? res1 : res2;
      expect(failedRes.body.error.code).toBe('INSUFFICIENT_AVAILABLE_QUANTITY');

      const resCount = await prisma.rentalQuantityReservation.count({
        where: { productId: singleProd.id, status: 'HELD' },
      });
      expect(resCount).toBe(1);
    });

    it('should enforce all-or-nothing reservation for multi-product orders when one product lacks capacity', async () => {
      const prodA = await prisma.rentalProduct.create({
        data: {
          categoryId: (await prisma.rentalCategory.findFirst())!.id,
          sku: `ALL-A-${randomUUID().slice(0, 8)}`,
          name: 'Product A',
          dailyPrice: 50000,
          replacementValue: 500000,
          depositValue: 100000,
          status: 'ACTIVE',
        },
      });
      await prisma.equipmentUnit.create({
        data: {
          productId: prodA.id,
          homeInventoryLocationId: locationId,
          currentInventoryLocationId: locationId,
          assetCode: `PROD-A-${randomUUID().slice(0, 8)}`,
          qrCode: `QR-PROD-A-${randomUUID().slice(0, 8)}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
        },
      });

      const prodB = await prisma.rentalProduct.create({
        data: {
          categoryId: (await prisma.rentalCategory.findFirst())!.id,
          sku: `ALL-B-${randomUUID().slice(0, 8)}`,
          name: 'Product B',
          dailyPrice: 50000,
          replacementValue: 500000,
          depositValue: 100000,
          status: 'ACTIVE',
        },
      });

      const qRes = await request(app.getHttpServer())
        .post('/api/v1/rentals/quote')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          tripId,
          items: [
            { productId: prodA.id, quantity: 1 },
            { productId: prodB.id, quantity: 1 },
          ],
        });

      expect(qRes.status).toBe(400);
      expect(qRes.body.error.code).toBe('INSUFFICIENT_AVAILABLE_QUANTITY');

      const aReservations = await prisma.rentalQuantityReservation.count({
        where: { productId: prodA.id },
      });
      expect(aReservations).toBe(0);
    });

    it('should accept payment when paidAt is before TTL even if worker runs after payment (delayed worker)', async () => {
      const uDelId = randomUUID();
      const uDelToken = randomUUID();
      tokens.set(uDelToken, { id: uDelId, email: `uDel-${uDelId.slice(0, 8)}@example.com` });
      await prisma.user.create({
        data: { id: uDelId, authUserId: uDelId, email: `uDel-${uDelId.slice(0, 8)}@example.com`, fullName: 'UDel', role: 'USER', status: 'ACTIVE' },
      });
      await prisma.tripMember.create({ data: { tripId, userId: uDelId, role: 'MEMBER', status: 'ACTIVE' } });

      const delProd = await prisma.rentalProduct.create({
        data: {
          categoryId: (await prisma.rentalCategory.findFirst())!.id,
          sku: `DEL-${randomUUID().slice(0, 8)}`,
          name: 'Delayed Product',
          dailyPrice: 100000,
          replacementValue: 2000000,
          depositValue: 500000,
          status: 'ACTIVE',
        },
      });
      await prisma.equipmentUnit.create({
        data: {
          productId: delProd.id,
          homeInventoryLocationId: locationId,
          currentInventoryLocationId: locationId,
          assetCode: `DEL-U-${randomUUID().slice(0, 8)}`,
          qrCode: `QR-DEL-${randomUUID().slice(0, 8)}`,
          status: 'AVAILABLE',
          condition: 'GOOD',
        },
      });

      const qRes = await request(app.getHttpServer())
        .post('/api/v1/rentals/quote')
        .set('Authorization', `Bearer ${uDelToken}`)
        .send({ tripId, items: [{ productId: delProd.id, quantity: 1 }] });
      expect(qRes.status).toBe(201);

      const oRes = await request(app.getHttpServer())
        .post('/api/v1/rental-orders')
        .set('Authorization', `Bearer ${uDelToken}`)
        .set('idempotency-key', randomUUID())
        .send({ quoteId: qRes.body.id });
      expect(oRes.status).toBe(201);
      const delayedOrderId = oRes.body.order.id;

      const pRes = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${delayedOrderId}/payments`)
        .set('Authorization', `Bearer ${uDelToken}`)
        .set('idempotency-key', randomUUID())
        .send({ paymentMethod: 'QR' });
      expect([200, 201]).toContain(pRes.status);
      const delayedPayId = pRes.body.paymentId;

      const paidTime = new Date();
      const timestamp = Math.floor(paidTime.getTime() / 1000).toString();
      const payloadObj = {
        kind: 'PAYMENT',
        providerEventId: `mock-evt-del-${delayedPayId}`,
        merchantRequestRef: 'payment:' + delayedPayId,
        transactionRef: `mock-txn-del-${delayedPayId}`,
        status: 'SUCCEEDED',
        amount: '700000',
        currency: 'VND',
        occurredAt: paidTime.toISOString(),
      };
      const rawBody = JSON.stringify(payloadObj);
      const sig = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET!).update(timestamp).update('.').update(Buffer.from(rawBody, 'utf8')).digest('hex');

      const hookRes = await request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/mock')
        .set('x-mock-timestamp', timestamp)
        .set('x-mock-signature', sig)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      expect(hookRes.status).toBe(200);

      const worker = app.get(PaymentEventsWorker);
      await worker.tick();

      const order = await prisma.rentalOrder.findUnique({ where: { id: delayedOrderId } });
      expect(order?.status).toBe('PAID');
    });

    it('should persist RentalCapacityAlert in PostgreSQL with actual occupied window and ACTION_REQUIRED', async () => {
      const alertProd = await prisma.rentalProduct.create({
        data: {
          categoryId: (await prisma.rentalCategory.findFirst())!.id,
          sku: `ALERT-${randomUUID().slice(0, 8)}`,
          name: 'Alert Tent',
          dailyPrice: 100000,
          replacementValue: 2000000,
          depositValue: 500000,
          status: 'ACTIVE',
        },
      });

      const qRes = await request(app.getHttpServer())
        .post('/api/v1/rentals/quote')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ tripId, items: [{ productId: alertProd.id, quantity: 10 }] });

      expect(qRes.status).toBe(400);
      expect(qRes.body.error.code).toBe('INSUFFICIENT_AVAILABLE_QUANTITY');

      const alert = await prisma.rentalCapacityAlert.findFirst({
        where: { productId: alertProd.id },
      });
      expect(alert).toBeDefined();
      expect(alert?.status).toBe('ACTION_REQUIRED');
      expect(alert?.reason).toBe('CAPACITY_INSUFFICIENT');
      expect(alert?.requestedQuantity).toBe(10);
      expect(alert?.availableCount).toBe(0);
      expect(alert?.occupiedFrom).toBeDefined();
      expect(alert?.occupiedUntil).toBeDefined();
      expect(alert?.occupiedFrom.getTime()).not.toEqual(alert?.occupiedUntil.getTime());
    });

    it('should enforce inventory location isolation in PostgreSQL: Warehouse A stock cannot serve Warehouse B request', async () => {
      const locA = await prisma.inventoryLocation.create({
        data: {
          code: `LOC-A-${randomUUID().slice(0, 8)}`,
          name: 'Warehouse A',
          address: 'Address A',
          status: 'ACTIVE',
        },
      });
      const locB = await prisma.inventoryLocation.create({
        data: {
          code: `LOC-B-${randomUUID().slice(0, 8)}`,
          name: 'Warehouse B',
          address: 'Address B',
          status: 'ACTIVE',
        },
      });

      const locProd = await prisma.rentalProduct.create({
        data: {
          categoryId: (await prisma.rentalCategory.findFirst())!.id,
          sku: `ISO-${randomUUID().slice(0, 8)}`,
          name: 'Isolated Tent',
          dailyPrice: 100000,
          replacementValue: 2000000,
          depositValue: 500000,
          status: 'ACTIVE',
        },
      });

      // Put 2 physical units in Warehouse A
      await prisma.equipmentUnit.createMany({
        data: [
          {
            productId: locProd.id,
            homeInventoryLocationId: locA.id,
            currentInventoryLocationId: locA.id,
            assetCode: `ISO-A1-${randomUUID().slice(0, 8)}`,
            qrCode: `QR-ISO-A1-${randomUUID().slice(0, 8)}`,
            status: 'AVAILABLE',
            condition: 'GOOD',
          },
          {
            productId: locProd.id,
            homeInventoryLocationId: locA.id,
            currentInventoryLocationId: locA.id,
            assetCode: `ISO-A2-${randomUUID().slice(0, 8)}`,
            qrCode: `QR-ISO-A2-${randomUUID().slice(0, 8)}`,
            status: 'AVAILABLE',
            condition: 'GOOD',
          },
        ],
      });
      // Warehouse B has 0 units

      const testNow = new Date();
      const testFrom = new Date(testNow.getTime() + 86400000);
      const testUntil = new Date(testNow.getTime() + 172800000);

      // Query capacity for Warehouse A -> MUST be 2
      const capA = await getVerifiedCapacitySnapshot(prisma, {
        productId: locProd.id,
        occupiedFrom: testFrom,
        occupiedUntil: testUntil,
        now: testNow,
        inventoryLocationId: locA.id,
      });
      expect(capA.availableCount).toBe(2);
      expect(capA.verifiedSupply).toBe(2);

      // Query capacity for Warehouse B -> MUST be 0 (cannot use Warehouse A stock)
      const capB = await getVerifiedCapacitySnapshot(prisma, {
        productId: locProd.id,
        occupiedFrom: testFrom,
        occupiedUntil: testUntil,
        now: testNow,
        inventoryLocationId: locB.id,
      });
      expect(capB.availableCount).toBe(0);
      expect(capB.verifiedSupply).toBe(0);

      // Verify availability adapter records shortage alert for Warehouse B
      const adapter = new PrismaRentalAvailabilityAdapter(prisma);
      const bAvailable = await adapter.getAvailableCount({
        productId: locProd.id,
        occupiedFrom: testFrom,
        occupiedUntil: testUntil,
        now: testNow,
        inventoryLocationId: locB.id,
        requestedQuantity: 1,
      });
      expect(bAvailable).toBe(0);

      const bAlert = await prisma.rentalCapacityAlert.findFirst({
        where: {
          productId: locProd.id,
          status: 'ACTION_REQUIRED',
        },
      });
      expect(bAlert).toBeDefined();
      expect(bAlert?.availableCount).toBe(0);
      expect(bAlert?.requestedQuantity).toBe(1);
    });
  });
});
