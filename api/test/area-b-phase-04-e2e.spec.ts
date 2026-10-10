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

    // Clean up test DB
    await prisma.inventoryTask.deleteMany();
    await prisma.paymentWebhookEvent.deleteMany();
    await prisma.paymentConsumerReceipt.deleteMany();
    await prisma.paymentOutboxEvent.deleteMany();
    await prisma.rentalQuantityReservation.deleteMany();
    await prisma.paymentApplication.deleteMany();
    await prisma.refundAllocation.deleteMany();
    await prisma.paymentAllocation.deleteMany();
    await prisma.rentalExtensionRequest.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.rentalOrderLine.deleteMany();
    await prisma.rentalOrder.deleteMany();
    await prisma.rentalQuoteLine.deleteMany();
    await prisma.rentalQuote.deleteMany();
    await prisma.equipmentUnit.deleteMany();
    await prisma.rentalProduct.deleteMany();
    await prisma.rentalCategory.deleteMany();
    await prisma.inventoryLocation.deleteMany();
    await prisma.tripMember.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.pickupPoint.deleteMany();
    await prisma.destination.deleteMany();
    await prisma.user.deleteMany();

    // Create users
    await prisma.user.create({
      data: { id: userId1, email: 'test1@example.com', fullName: 'Test 1', role: 'USER', status: 'ACTIVE', authUserId: userId1 },
    });
    await prisma.user.create({
      data: { id: userId2, email: 'test2@example.com', fullName: 'Test 2', role: 'USER', status: 'ACTIVE', authUserId: userId2 },
    });

    await prisma.rentalPolicy.deleteMany();
    await prisma.rentalPolicy.create({
      data: {
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
      }
    });

    // Create a trip
    const destination = await prisma.destination.create({
      data: { id: randomUUID(), name: 'Test Dest', region: 'VN' }
    });

    const pickup = await prisma.pickupPoint.create({
      data: {
        id: randomUUID(),
        code: 'PUP-01',
        name: 'Test Pickup',
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
        title: 'Test Trip',
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
      data: { code: 'WH-01', name: 'Main Warehouse', address: '123 Main St', status: 'ACTIVE' },
    });
    locationId = loc.id;
    process.env.RENTAL_DEFAULT_INVENTORY_LOCATION_ID = locationId;

    // Category and Product
    const cat = await prisma.rentalCategory.create({
      data: { name: 'Tents', slug: 'tents' },
    });
    const prod = await prisma.rentalProduct.create({
      data: {
        categoryId: cat.id,
        sku: 'TENT-E2E',
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
          assetCode: `TENT-E2E-${i}`,
          qrCode: `QR-TENT-${i}`,
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
          providerEventId: 'mock-evt-1',
          merchantRequestRef: 'payment:' + paymentIdVal,
          transactionRef: 'mock-txn-1',
          status: 'SUCCEEDED',
          amount: '700000',
          currency: 'VND',
          occurredAt: new Date().toISOString()
      };
      const rawBodyStr = JSON.stringify(payloadObj);
      const sig = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET).update(timestamp).update('.').update(Buffer.from(rawBodyStr, 'utf8')).digest('hex');

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
          providerEventId: 'mock-evt-late',
          merchantRequestRef: 'payment:' + payId,
          transactionRef: 'mock-txn-late',
          status: 'SUCCEEDED',
          amount: '700000',
          currency: 'VND',
          occurredAt: new Date().toISOString()
      };
      const rawBodyStrLate = JSON.stringify(payloadObjLate);
      const sigLate = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET).update(timestampLate).update('.').update(Buffer.from(rawBodyStrLate, 'utf8')).digest('hex');

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
          providerEventId: 'mock-evt-1',
          merchantRequestRef: 'payment:' + paymentIdVal,
          transactionRef: 'mock-txn-1',
          status: 'SUCCEEDED',
          amount: '700000',
          currency: 'VND',
          occurredAt: new Date().toISOString()
      };
      const rawBodyStrDup = JSON.stringify(payloadObjDup);
      const sigDup = crypto.createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET).update(timestampDup).update('.').update(Buffer.from(rawBodyStrDup, 'utf8')).digest('hex');

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
  });
});
