import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RentalTripController } from './rental-booking.controller';
import { GetRentalEligibilityUseCase } from '../../application/use-cases/get-rental-eligibility.use-case';
import { GetRentalRecommendationsUseCase } from '../../application/use-cases/get-rental-recommendations.use-case';
import { GlobalErrorFilter } from 'src/shared/errors/global-error.filter';
import { AppError } from 'src/shared/errors/app-error';
import { REQUEST_USER_KEY } from 'src/shared/constants/auth.constant';

describe('RentalTripController — GlobalErrorFilter Contract & Status Verification', () => {
  let app: INestApplication;
  let mockEligibilityUseCase: { execute: jest.Mock };
  let mockRecommendationsUseCase: { execute: jest.Mock };

  beforeAll(async () => {
    mockEligibilityUseCase = { execute: jest.fn() };
    mockRecommendationsUseCase = { execute: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RentalTripController],
      providers: [
        {
          provide: GetRentalEligibilityUseCase,
          useValue: mockEligibilityUseCase,
        },
        {
          provide: GetRentalRecommendationsUseCase,
          useValue: mockRecommendationsUseCase,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    // Mock authentication middleware so @ActiveUser injects user
    app.use((req: any, _res: any, next: () => void) => {
      req[REQUEST_USER_KEY] = {
        id: 'user-authenticated-1',
        sub: 'user-authenticated-1',
        role: 'USER',
      };
      next();
    });

    app.useGlobalFilters(new GlobalErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('trip không tồn tại: trả về HTTP 404 với đúng envelope { error: { code: "TRIP_NOT_FOUND", ... } }, không 500', async () => {
    mockEligibilityUseCase.execute.mockRejectedValueOnce(
      AppError.fromCode('TRIP_NOT_FOUND'),
    );

    const response = await request(app.getHttpServer())
      .get('/trips/00000000-0000-0000-0000-000000000000/rental-eligibility')
      .expect(404);

    expect(response.body).toEqual({
      error: {
        code: 'TRIP_NOT_FOUND',
        message: expect.any(String),
        retryable: false,
      },
      meta: {
        requestId: expect.any(String),
        serverTime: expect.any(String),
        contractVersion: '0.2.0-final-flow',
      },
    });
  });

  it('trip tồn tại nhưng user không có membership: trả về HTTP 200 eligible=false theo FR, không 500', async () => {
    mockEligibilityUseCase.execute.mockResolvedValueOnce({
      eligible: false,
      reason: 'TRIP_MEMBERSHIP_NOT_FOUND',
      cutoff: '2026-10-09T06:00:00.000Z',
      contextVersion: 1,
    });

    const response = await request(app.getHttpServer())
      .get('/trips/550e8400-e29b-41d4-a716-446655440000/rental-eligibility')
      .expect(200);

    expect(response.body).toEqual({
      eligible: false,
      reason: 'TRIP_MEMBERSHIP_NOT_FOUND',
      cutoff: '2026-10-09T06:00:00.000Z',
      contextVersion: 1,
    });
  });

  it('Area A unavailable: trả về HTTP 503 retryable=true với code AREA_A_CONTEXT_UNAVAILABLE, không 500', async () => {
    mockEligibilityUseCase.execute.mockRejectedValueOnce(
      AppError.fromCode('AREA_A_CONTEXT_UNAVAILABLE'),
    );

    const response = await request(app.getHttpServer())
      .get('/trips/550e8400-e29b-41d4-a716-446655440000/rental-eligibility')
      .expect(503);

    expect(response.body).toEqual({
      error: {
        code: 'AREA_A_CONTEXT_UNAVAILABLE',
        message: expect.any(String),
        retryable: true,
      },
      meta: {
        requestId: expect.any(String),
        serverTime: expect.any(String),
        contractVersion: '0.2.0-final-flow',
      },
    });
  });

  it('Trip logistics unavailable: trả về HTTP 503 retryable=true với code TRIP_LOGISTICS_UNAVAILABLE, không 500', async () => {
    mockEligibilityUseCase.execute.mockRejectedValueOnce(
      AppError.fromCode('TRIP_LOGISTICS_UNAVAILABLE'),
    );

    const response = await request(app.getHttpServer())
      .get('/trips/550e8400-e29b-41d4-a716-446655440000/rental-eligibility')
      .expect(503);

    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'TRIP_LOGISTICS_UNAVAILABLE',
        retryable: true,
      }),
    );
  });

  it('Cutoff passed: trả về HTTP 409 conflict với code RENTAL_CUTOFF_PASSED, không 500', async () => {
    mockEligibilityUseCase.execute.mockRejectedValueOnce(
      AppError.fromCode('RENTAL_CUTOFF_PASSED'),
    );

    const response = await request(app.getHttpServer())
      .get('/trips/550e8400-e29b-41d4-a716-446655440000/rental-eligibility')
      .expect(409);

    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: 'RENTAL_CUTOFF_PASSED',
        retryable: false,
      }),
    );
  });
});
