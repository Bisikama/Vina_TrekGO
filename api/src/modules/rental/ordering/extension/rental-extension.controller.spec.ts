import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, CallHandler } from '@nestjs/common';
import request from 'supertest';

jest.mock('@nestjs/schedule', () => ({
  Cron: jest.fn(() => () => {}),
  CronExpression: {},
  Interval: jest.fn(() => () => {}),
}));

import { RentalExtensionController } from './rental-extension.controller';
import { RentalExtensionService } from './rental-extension.service';
import { RentalExtensionPaymentsController } from '../../payments/rental-extension-payments.controller';
import { PaymentsPort } from '../../../payments/payments.port';
import { GlobalErrorFilter } from '../../../../shared/errors/global-error.filter';
import { REQUEST_USER_KEY } from '../../../../shared/constants/auth.constant';
import { UserRole } from '../../../../shared/constants';

describe('RentalExtensionController & Payments (HTTP Route Contract RB-API-801..804)', () => {
  let app: INestApplication;
  let mockExtensionService: jest.Mocked<Partial<RentalExtensionService>>;
  let mockPaymentsPort: jest.Mocked<Partial<PaymentsPort>>;

  const dummyOrderId = '11111111-1111-4111-8111-111111111111';
  const dummyQuoteId = '22222222-2222-4222-8222-222222222222';
  const dummyExtensionId = '33333333-3333-4333-8333-333333333333';
  const testUserId = 'user-test-uuid-001';

  beforeEach(async () => {
    mockExtensionService = {
      quote: jest.fn().mockResolvedValue({
        extensionQuoteId: dummyQuoteId,
        orderId: dummyOrderId,
        previousRentalEndAt: new Date('2026-10-20T10:00:00.000Z'),
        requestedRentalEndAt: new Date('2026-10-21T10:00:00.000Z'),
        additionalFee: 150000,
        policySnapshot: { postReturnBufferHours: 24 },
        expiresAt: new Date('2026-10-20T08:30:00.000Z'),
        termsVersion: 'v1.5.2',
        termsHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      }),
      confirm: jest.fn().mockResolvedValue({
        extensionRequestId: dummyExtensionId,
        status: 'PENDING_PAYMENT',
        paymentRequired: true,
        additionalFee: 150000,
        holdExpiresAt: new Date(Date.now() + 15 * 60000),
      }),
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: dummyExtensionId,
            rentalOrderId: dummyOrderId,
            status: 'PENDING_PAYMENT',
            additionalFee: 150000,
            requestedRentalEndAt: new Date('2026-10-21T10:00:00.000Z'),
          },
        ],
      }),
    };

    mockPaymentsPort = {
      createRentalExtensionCheckout: jest.fn().mockResolvedValue({
        httpStatus: 201,
        body: {
          checkoutSessionId: 'sess-ext-123',
          checkoutUrl: 'https://pay.example.com/checkout/sess-ext-123',
          qrCode: 'qr-data-string',
          paymentStatus: 'PENDING',
        },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RentalExtensionController, RentalExtensionPaymentsController],
      providers: [
        { provide: RentalExtensionService, useValue: mockExtensionService },
        { provide: PaymentsPort, useValue: mockPaymentsPort },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalErrorFilter());

    // Inject mock user middleware for ActiveUser decorator
    app.use((req: any, _res: any, next: () => void) => {
      req[REQUEST_USER_KEY] = {
        id: testUserId,
        role: UserRole.USER,
        email: 'test@example.com',
      };
      next();
    });

    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  describe('RB-API-801: POST /api/v1/rental-orders/:id/extension-quotes', () => {
    it('generates extension quote with termsVersion and termsHash', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/extension-quotes`)
        .send({
          requestedReturnAt: '2026-10-21T10:00:00.000Z',
          returnOptionId: 'RETURN_AT_BASE',
        })
        .expect(200); // RB-API-801 specifies 200 OK

      expect(mockExtensionService.quote).toHaveBeenCalledWith(
        testUserId,
        dummyOrderId,
        expect.any(Date),
        'RETURN_AT_BASE',
      );
      expect(res.body.extensionQuoteId).toBe(dummyQuoteId);
      expect(res.body.termsVersion).toBe('v1.5.2');
      expect(res.body.termsHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('rejects invalid uuid in route param with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/rental-orders/invalid-uuid/extension-quotes')
        .send({
          requestedReturnAt: '2026-10-21T10:00:00.000Z',
          returnOptionId: 'RETURN_AT_BASE',
        })
        .expect(400);
    });
  });

  describe('RB-API-802: POST /api/v1/rental-orders/:id/extensions', () => {
    it('confirms extension with Idempotency-Key and accepted terms contract', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/extensions`)
        .set('Idempotency-Key', 'idemp-ext-test-123')
        .send({
          extensionQuoteId: dummyQuoteId,
          expectedVersion: 1,
          acceptedTermsVersion: 'v1.5.2',
          termsHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        })
        .expect(201);

      expect(mockExtensionService.confirm).toHaveBeenCalledWith(
        testUserId,
        dummyOrderId,
        dummyQuoteId,
        1,
        'idemp-ext-test-123',
        'v1.5.2',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
      expect(res.body.extensionRequestId).toBe(dummyExtensionId);
      expect(res.body.status).toBe('PENDING_PAYMENT');
    });

    it('rejects missing Idempotency-Key header with 400', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/rental-orders/${dummyOrderId}/extensions`)
        .send({
          extensionQuoteId: dummyQuoteId,
          expectedVersion: 1,
          acceptedTermsVersion: 'v1.5.2',
        })
        .expect(400);
    });
  });

  describe('RB-API-803: POST /api/v1/rental-extensions/:id/payments', () => {
    it('creates extension checkout session via PaymentsPort', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rental-extensions/${dummyExtensionId}/payments`)
        .set('idempotency-key', 'idemp-pay-test-456')
        .send({
          paymentMethod: 'QR',
          gateway: 'momo',
        })
        .expect(201);

      expect(mockPaymentsPort.createRentalExtensionCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionId: dummyExtensionId,
          actorUserId: testUserId,
          idempotencyKey: 'idemp-pay-test-456',
          paymentMethod: 'QR',
          gateway: 'momo',
        }),
      );
      expect(res.body.checkoutSessionId).toBe('sess-ext-123');
      expect(res.body.checkoutUrl).toBe('https://pay.example.com/checkout/sess-ext-123');
    });
  });

  describe('RB-API-804: GET /api/v1/rental-orders/:id/extensions', () => {
    it('retrieves extension history for the order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rental-orders/${dummyOrderId}/extensions`)
        .expect(200);

      expect(mockExtensionService.list).toHaveBeenCalledWith(testUserId, dummyOrderId);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items[0].id).toBe(dummyExtensionId);
    });
  });
});
