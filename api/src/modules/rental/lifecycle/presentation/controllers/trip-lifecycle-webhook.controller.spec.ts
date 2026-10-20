import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TripLifecycleWebhookController } from './trip-lifecycle-webhook.controller';
import { HandleTripRescheduledUseCase } from '../../application/use-cases/handle-trip-rescheduled.use-case';
import { HandleTripCancelledUseCase } from '../../application/use-cases/handle-trip-cancelled.use-case';
import { HandleBookingCancelledUseCase } from '../../application/use-cases/handle-booking-cancelled.use-case';
import { TRIP_LIFECYCLE_PORT } from '../../application/ports/trip-lifecycle.port';
import { GlobalErrorFilter } from 'src/shared/errors/global-error.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const VALID_API_KEY = 'secret-test-key-123456';

describe('TripLifecycleWebhookController (HTTP Route Contract & Fail-Closed Security)', () => {
  let app: INestApplication;
  let mockRescheduleUseCase: jest.Mocked<Partial<HandleTripRescheduledUseCase>>;
  let mockCancelTripUseCase: jest.Mocked<Partial<HandleTripCancelledUseCase>>;
  let mockCancelBookingUseCase: jest.Mocked<Partial<HandleBookingCancelledUseCase>>;

  beforeEach(async () => {
    process.env.RENTAL_INTEGRATION_API_KEY = VALID_API_KEY;

    mockRescheduleUseCase = {
      execute: jest.fn().mockResolvedValue({
        eventId: 'evt-1',
        status: 'PROCESSED',
        affectedOrderCount: 1,
        affectedOrderIds: ['order-1'],
        conflicts: [],
        scheduleNoticesIssued: [],
      }),
    };

    mockCancelTripUseCase = {
      execute: jest.fn().mockResolvedValue({
        eventId: 'evt-2',
        status: 'PROCESSED',
        affectedOrderCount: 1,
        affectedOrderIds: ['order-1'],
        conflicts: [],
        scheduleNoticesIssued: [],
        cancelledOrderIds: ['order-1'],
      }),
    };

    mockCancelBookingUseCase = {
      execute: jest.fn().mockResolvedValue({
        eventId: 'evt-3',
        status: 'PROCESSED',
        affectedOrderCount: 1,
        affectedOrderIds: ['order-1'],
        conflicts: [],
        scheduleNoticesIssued: [],
        cancelledOrderIds: ['order-1'],
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TripLifecycleWebhookController],
      providers: [
        { provide: HandleTripRescheduledUseCase, useValue: mockRescheduleUseCase },
        { provide: HandleTripCancelledUseCase, useValue: mockCancelTripUseCase },
        { provide: HandleBookingCancelledUseCase, useValue: mockCancelBookingUseCase },
        { provide: TRIP_LIFECYCLE_PORT, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new GlobalErrorFilter());
    await app.init();
  });

  afterEach(async () => {
    delete process.env.RENTAL_INTEGRATION_API_KEY;
    await app.close();
  });

  describe('Security & Fail-Closed Verification (P0-01)', () => {
    const validReschedulePayload = {
      eventId: 'evt-sec-1',
      eventType: 'TRIP_RESCHEDULED',
      entityId: '550e8400-e29b-41d4-a716-446655440000',
      entityVersion: 2,
      correlationId: 'corr-sec-1',
      occurredAt: '2026-11-01T00:00:00.000Z',
      payload: {
        tripId: '550e8400-e29b-41d4-a716-446655440000',
        newStartAt: '2026-11-01T08:00:00.000Z',
        newEndAt: '2026-11-03T18:00:00.000Z',
        contextVersion: 2,
      },
    };

    it('rejects with 401 when RENTAL_INTEGRATION_API_KEY is not configured in env', async () => {
      delete process.env.RENTAL_INTEGRATION_API_KEY;

      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/reschedule')
        .set('x-api-key', VALID_API_KEY)
        .send(validReschedulePayload)
        .expect(401);

      expect(res.body.error.code).toBe('RENTAL_INTEGRATION_API_KEY_INVALID');
      expect(mockRescheduleUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects with 401 when RENTAL_INTEGRATION_API_KEY is empty string in env', async () => {
      process.env.RENTAL_INTEGRATION_API_KEY = '';

      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/reschedule')
        .set('x-api-key', '')
        .send(validReschedulePayload)
        .expect(401);

      expect(res.body.error.code).toBe('RENTAL_INTEGRATION_API_KEY_INVALID');
      expect(mockRescheduleUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects with 401 when x-api-key header is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/reschedule')
        .send(validReschedulePayload)
        .expect(401);

      expect(res.body.error.code).toBe('RENTAL_INTEGRATION_API_KEY_INVALID');
      expect(mockRescheduleUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects with 401 when x-api-key header has mismatched key', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/reschedule')
        .set('x-api-key', 'attacker-wrong-key')
        .send(validReschedulePayload)
        .expect(401);

      expect(res.body.error.code).toBe('RENTAL_INTEGRATION_API_KEY_INVALID');
      expect(mockRescheduleUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects generic dispatcher when x-api-key is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events')
        .set('x-api-key', 'wrong-key')
        .send(validReschedulePayload)
        .expect(401);

      expect(res.body.error.code).toBe('RENTAL_INTEGRATION_API_KEY_INVALID');
    });

    it('rejects cancel-trip when x-api-key is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/cancel-trip')
        .send({
          eventId: 'evt-sec-2',
          eventType: 'TRIP_CANCELLED',
          entityId: '550e8400-e29b-41d4-a716-446655440000',
          entityVersion: 1,
          correlationId: 'corr-sec-2',
          occurredAt: '2026-11-01T00:00:00.000Z',
          payload: {
            tripId: '550e8400-e29b-41d4-a716-446655440000',
            reason: 'Test',
            effectiveAt: '2026-11-01T00:00:00.000Z',
            tripVersion: 1,
          },
        })
        .expect(401);

      expect(res.body.error.code).toBe('RENTAL_INTEGRATION_API_KEY_INVALID');
    });

    it('rejects cancel-booking when x-api-key is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/cancel-booking')
        .send({
          eventId: 'evt-sec-3',
          eventType: 'BOOKING_CANCELLED',
          entityId: '550e8400-e29b-41d4-a716-446655440001',
          entityVersion: 1,
          correlationId: 'corr-sec-3',
          occurredAt: '2026-11-01T00:00:00.000Z',
          payload: {
            bookingId: '550e8400-e29b-41d4-a716-446655440001',
            reason: 'Test',
            effectiveAt: '2026-11-01T00:00:00.000Z',
            version: 1,
          },
        })
        .expect(401);

      expect(res.body.error.code).toBe('RENTAL_INTEGRATION_API_KEY_INVALID');
    });
  });

  describe('Authenticated Functional Routes', () => {
    it('publishes x-api-key security, request examples, and response schemas in Swagger', () => {
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().addApiKey(
        { type: 'apiKey', name: 'x-api-key', in: 'header' },
        'x-api-key',
      ).build());
      const operation = document.paths['/api/v1/internal/rental/trip-events/reschedule']?.post;
      const requestBody = operation?.requestBody as {
        content?: Record<string, { schema?: { example?: Record<string, unknown> } }>;
      };
      const response = operation?.responses?.['200'] as {
        content?: Record<string, { schema?: { example?: Record<string, unknown> } }>;
      };

      expect(operation?.operationId).toBe('handleRentalTripRescheduled');
      expect(operation?.security).toEqual([{ 'x-api-key': [] }]);
      expect(requestBody.content?.['application/json'].schema?.example).toMatchObject({ eventType: 'TRIP_RESCHEDULED' });
      expect(response.content?.['application/json'].schema?.example).toMatchObject({ status: 'PROCESSED' });
    });

    it('POST /api/v1/internal/rental/trip-events/reschedule - accepts valid payload with correct key', async () => {
      const payload = {
        eventId: 'evt-http-1',
        eventType: 'TRIP_RESCHEDULED',
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        entityVersion: 2,
        correlationId: 'corr-http-1',
        occurredAt: '2026-11-01T00:00:00.000Z',
        payload: {
          tripId: '550e8400-e29b-41d4-a716-446655440000',
          newStartAt: '2026-11-01T08:00:00.000Z',
          newEndAt: '2026-11-03T18:00:00.000Z',
          contextVersion: 2,
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/reschedule')
        .set('x-api-key', VALID_API_KEY)
        .send(payload)
        .expect(200);

      expect(res.body.status).toBe('PROCESSED');
      expect(mockRescheduleUseCase.execute).toHaveBeenCalled();
    });

    it('POST /api/v1/internal/rental/trip-events/cancel-trip - processes cancellation with correct key', async () => {
      const payload = {
        eventId: 'evt-http-2',
        eventType: 'TRIP_CANCELLED',
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        entityVersion: 3,
        correlationId: 'corr-http-2',
        occurredAt: '2026-11-01T00:00:00.000Z',
        payload: {
          tripId: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'Storm warning',
          effectiveAt: '2026-11-01T00:00:00.000Z',
          tripVersion: 3,
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/cancel-trip')
        .set('x-api-key', VALID_API_KEY)
        .send(payload)
        .expect(200);

      expect(res.body.status).toBe('PROCESSED');
      expect(mockCancelTripUseCase.execute).toHaveBeenCalled();
    });

    it('POST /api/v1/internal/rental/trip-events/cancel-booking - processes booking cancellation with correct key', async () => {
      const payload = {
        eventId: 'evt-http-3',
        eventType: 'BOOKING_CANCELLED',
        entityId: '550e8400-e29b-41d4-a716-446655440001',
        entityVersion: 1,
        correlationId: 'corr-http-3',
        occurredAt: '2026-11-01T00:00:00.000Z',
        payload: {
          bookingId: '550e8400-e29b-41d4-a716-446655440001',
          reason: 'Member withdraw',
          effectiveAt: '2026-11-01T00:00:00.000Z',
          version: 1,
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events/cancel-booking')
        .set('x-api-key', VALID_API_KEY)
        .send(payload)
        .expect(200);

      expect(res.body.status).toBe('PROCESSED');
      expect(mockCancelBookingUseCase.execute).toHaveBeenCalled();
    });

    it('POST /api/v1/internal/rental/trip-events - generic dispatcher routes correctly with correct key', async () => {
      const payload = {
        eventId: 'evt-http-gen',
        eventType: 'TRIP_RESCHEDULED',
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        entityVersion: 2,
        correlationId: 'corr-gen',
        occurredAt: '2026-11-01T00:00:00.000Z',
        payload: {
          tripId: '550e8400-e29b-41d4-a716-446655440000',
          newStartAt: '2026-11-01T08:00:00.000Z',
          newEndAt: '2026-11-03T18:00:00.000Z',
          contextVersion: 2,
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events')
        .set('x-api-key', VALID_API_KEY)
        .send(payload)
        .expect(200);

      expect(res.body.status).toBe('PROCESSED');
      expect(mockRescheduleUseCase.execute).toHaveBeenCalled();
    });

    it('POST /api/v1/internal/rental/trip-events - rejects unsupported eventType', async () => {
      const payload = {
        eventId: 'evt-http-unsupported',
        eventType: 'UNKNOWN_EVENT_TYPE',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events')
        .set('x-api-key', VALID_API_KEY)
        .send(payload)
        .expect(422);

      expect(res.body.error.code).toBe('RENTAL_LIFECYCLE_EVENT_UNSUPPORTED');
    });

    it('POST /api/v1/internal/rental/trip-events - returns validation contract for malformed supported event', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/internal/rental/trip-events')
        .set('x-api-key', VALID_API_KEY)
        .send({ eventType: 'TRIP_RESCHEDULED' })
        .expect(400);

      expect(res.body).toMatchObject({
        error: { code: 'VALIDATION_ERROR', retryable: false },
        meta: { contractVersion: '0.2.0-final-flow' },
      });
    });
  });
});
