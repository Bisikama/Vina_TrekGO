 
import type { RentalAvailabilityPort } from '../ports/rental-availability.port';
import type {
  RentalCatalogPort,
  RentalProductTransactionData,
} from '../ports/rental-catalog.port';
import type {
  RentalContextPort,
  RentalEligibilityContext,
} from '../ports/rental-context.port';
import type { RentalQuotePort } from '../ports/rental-quote.port';
import { CreateRentalQuoteUseCase } from './create-rental-quote.use-case';
import { GetRentalAvailabilityUseCase } from './get-rental-availability.use-case';
import { GetRentalEligibilityUseCase } from './get-rental-eligibility.use-case';
import { GetRentalRecommendationsUseCase } from './get-rental-recommendations.use-case';

function createContext(): RentalEligibilityContext {
  return {
    userId: '22222222-2222-4222-8222-222222222222',
    membershipRef: '44444444-4444-4444-8444-444444444444',
    membershipStatus: 'ACTIVE', membershipRole: 'MEMBER', rentalEligible: true, ineligibleReason: null, bookingId: null,
    trip: {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Tà Năng - Phan Dũng',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T01:00:00Z'),
      endAt: new Date('2026-10-12T10:00:00Z'),
      timezone: 'Asia/Ho_Chi_Minh',
      difficulty: 'MEDIUM',
      weatherSummary: 'Có khả năng mưa nhẹ',
      rainProbabilityPercent: 40,
    },
    recipientOptions: [
      {
        memberId: '44444444-4444-4444-8444-444444444444',
        userId: '22222222-2222-4222-8222-222222222222',
        displayName: 'Nguyễn An',
        phone: '0900000000',
        status: 'ACTIVE',
      },
    ],
    pickup: {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Điểm tập trung',
      address: 'TP.HCM',
      scheduledAt: new Date('2026-10-10T00:00:00Z'),
    },
    dropoff: {
      id: '66666666-6666-4666-8666-666666666666',
      name: 'Điểm trả',
      address: 'TP.HCM',
      scheduledAt: new Date('2026-10-12T12:00:00Z'),
    },
    returnOptions: [],
    rentalCutoffAt: new Date('2026-10-09T00:00:00Z'),
    contextVersion: 4,
    existingOpenOrderId: null,
    activePolicy: {
      id: '77777777-7777-4777-8777-777777777777',
      policyCode: 'rental-policy',
      versionNo: 2,
      currency: 'VND', dayCountMode: 'CEIL_24H', maxRentalAfterTripHours: null, extensionRequestCutoffMinutes: null, extensionHoldMinutes: null,
      quoteTtlMinutes: 15,
      paymentHoldMinutes: 15,
      freeCancellationHours: 24,
      cutoffHoursBeforeTrip: 25,
      prepBufferMinutes: 360,
      returnBufferMinutes: 1440,
      cleaningBufferMinutes: 1440,
      deepInspectionBufferMinutes: 2880,
      overdueReviewMinutes: null,
      snapshot: {
        policyCode: 'rental-policy',
        versionNo: 2,
        currency: 'VND', dayCountMode: 'CEIL_24H', maxRentalAfterTripHours: null, extensionRequestCutoffMinutes: null, extensionHoldMinutes: null,
        quoteTtlMinutes: 15,
        paymentHoldMinutes: 15,
        freeCancellationHours: 24,
        cutoffHoursBeforeTrip: 25,
        prepBufferMinutes: 360,
        returnBufferMinutes: 1440,
        cleaningBufferMinutes: 1440,
        deepInspectionBufferMinutes: 2880,
        overdueReviewMinutes: null,
        cancellationRules: {},
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
      },
    },
  };
}

function createProduct(): RentalProductTransactionData {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    name: 'Lều 4 người',
    status: 'ACTIVE',
    dailyPrice: '120000.00',
    currency: 'VND',
    depositPolicyType: 'FIXED',
    depositValue: '500000.00',
    replacementValue: '2000000.00',
    categoryId: '99999999-9999-4999-8999-999999999999',
    recommendationTags: ['MULTI_DAY', 'MODERATE_TRAIL', 'RAIN_READY'],
  };
}

describe('B1 rental flow use cases', () => {
  const ownerUserId = '22222222-2222-4222-8222-222222222222';
  const now = new Date('2026-09-25T10:00:00Z');

  let contextPort: jest.Mocked<RentalContextPort>;
  let catalogPort: jest.Mocked<RentalCatalogPort>;
  let availabilityPort: jest.Mocked<RentalAvailabilityPort>;
  let quotePort: jest.Mocked<RentalQuotePort>;

  const originalPrimaryLoc = process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID;

  beforeAll(() => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = '11111111-1111-4111-8111-111111111111';
  });

  afterAll(() => {
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = originalPrimaryLoc;
  });

  beforeEach(() => {
    contextPort = {
      getByTripId: jest.fn().mockResolvedValue(createContext()),
    };
    catalogPort = {
      getProductsByIds: jest.fn().mockResolvedValue([createProduct()]),
      listActiveProducts: jest.fn().mockResolvedValue([createProduct()]),
    };
    availabilityPort = {
      getAvailableCount: jest.fn().mockResolvedValue(3),
    };
    quotePort = {
      createQuote: jest.fn().mockResolvedValue({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        expiresAt: new Date('2026-09-25T10:15:00Z'),
        createdAt: now,
      }),
    };
  });

  it('RB-API-101: trả eligible=true cho Trip membership', async () => {
    const useCase = new GetRentalEligibilityUseCase(contextPort);

    const result = await useCase.execute({
      tripId: createContext().trip.id,
      userId: ownerUserId,
      now,
    });

    expect(result.eligible).toBe(true);
    expect(result.contextVersion).toBe(4);
    expect(result.allowedActions).toEqual(['CREATE_RENTAL']);
  });

  it('hides CREATE_RENTAL while a live pending-payment order exists', async () => {
    const context = createContext();
    context.existingOpenOrderId = 'pending-order-uuid';
    contextPort.getByTripId.mockResolvedValue(context);
    const useCase = new GetRentalEligibilityUseCase(contextPort);

    const result = await useCase.execute({
      tripId: context.trip.id,
      userId: ownerUserId,
      now,
    });

    expect(result.eligible).toBe(true);
    expect(result.allowedActions).toEqual([]);
  });

  it('RB-API-101: chặn User khác bằng FORBIDDEN', async () => {
    const useCase = new GetRentalEligibilityUseCase(contextPort);

    await expect(
      useCase.execute({
        tripId: createContext().trip.id,
        userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        now,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('RB-API-102: availability không dùng participant quota', async () => {
    const useCase = new GetRentalAvailabilityUseCase(
      contextPort,
      catalogPort,
      availabilityPort,
    );

    const result = await useCase.execute({
      tripId: createContext().trip.id,
      productId: createProduct().id,
      userId: ownerUserId,
      now,
    });

    expect(result.availableCount).toBe(3);
    expect(availabilityPort.getAvailableCount).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: createProduct().id,
         occupiedFrom: new Date('2026-10-09T12:00:00Z'),
        occupiedUntil: new Date('2026-10-13T12:00:00Z'),
      }),
    );
  });

  it('RB-API-103: tạo quote server-side và không gọi bất kỳ reservation port nào', async () => {
    const useCase = new CreateRentalQuoteUseCase(
      contextPort,
      catalogPort,
      availabilityPort,
      quotePort,
    );

    const result = await useCase.execute({
      tripId: createContext().trip.id,
      userId: ownerUserId,
      items: [{ productId: createProduct().id, quantity: 2 }],
      now,
    });

    expect(result.chargedDays).toBe(3);
    expect(result.items[0]).toMatchObject({
      dailyPrice: 120000,
      feeAmount: 720000,
      depositPerUnit: 500000,
      replacementValue: 2000000,
      depositExplanation: { percentageOfReplacementValue: 25, formula: 'depositPerUnit / replacementValue * 100' },
      depositAmount: 1000000,
      availableCount: 3,
    });
    expect(result.amounts.totalAmount).toBe(1720000);

    expect(quotePort.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        contextVersion: 4,
        rentalFee: '720000.00',
        totalDeposit: '1000000.00',
        totalAmount: '1720000.00',
      }),
    );
  });

  it('sản phẩm hạng Rất mới tính tiền như sản phẩm thường: 2 món, 100k/ngày, cọc 600k, 60 giờ', async () => {
    // Hạng không đổi luồng thuê: giá/cọc lấy từ chính sản phẩm của hạng đó (60 giờ → 3 ngày theo CEIL_24H).
    catalogPort.getProductsByIds.mockResolvedValue([
      { ...createProduct(), name: 'Lều 3 người – Rất mới', dailyPrice: '100000.00', depositValue: '600000.00' },
    ]);
    const useCase = new CreateRentalQuoteUseCase(contextPort, catalogPort, availabilityPort, quotePort);

    const result = await useCase.execute({
      tripId: createContext().trip.id,
      userId: ownerUserId,
      items: [{ productId: createProduct().id, quantity: 2 }],
      now,
    });

    expect(result.chargedDays).toBe(3);
    expect(result.items[0]).toMatchObject({ feeAmount: 600000, depositPerUnit: 600000, depositAmount: 1200000 });
    expect(quotePort.createQuote).toHaveBeenCalledWith(
      expect.objectContaining({ rentalFee: '600000.00', totalDeposit: '1200000.00', totalAmount: '1800000.00' }),
    );
  });

  it('RB-API-103: reject khi quantity vượt availableCount', async () => {
    availabilityPort.getAvailableCount.mockResolvedValue(1);
    const useCase = new CreateRentalQuoteUseCase(
      contextPort,
      catalogPort,
      availabilityPort,
      quotePort,
    );

    await expect(
      useCase.execute({
        tripId: createContext().trip.id,
        userId: ownerUserId,
        items: [{ productId: createProduct().id, quantity: 2 }],
        now,
      }),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_AVAILABLE_QUANTITY',
    });

    expect(quotePort.createQuote).not.toHaveBeenCalled();
  });

  it('RB-API-103: reject khi recipient không thuộc Trip', async () => {
    const useCase = new CreateRentalQuoteUseCase(
      contextPort,
      catalogPort,
      availabilityPort,
      quotePort,
    );

    await expect(
      useCase.execute({
        tripId: createContext().trip.id,
        userId: ownerUserId,
        recipientTripMemberId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        items: [{ productId: createProduct().id, quantity: 1 }],
        now,
      }),
    ).rejects.toMatchObject({ code: 'RENTAL_RECIPIENT_INVALID' });
  });

  it('RB-API-104: rule-based dùng MULTI_DAY/MODERATE_TRAIL/RAIN_READY', async () => {
    const useCase = new GetRentalRecommendationsUseCase(contextPort, catalogPort);

    const result = await useCase.execute({
      tripId: createContext().trip.id,
      userId: ownerUserId,
      limit: 5,
      now,
    });

    expect(result.recommendations[0]).toEqual({
      productId: createProduct().id,
      score: 1,
      reasons: ['Chuyến 3 ngày', 'Độ khó trung bình', 'Thời tiết có khả năng mưa'],
      source: 'RULE',
    });
  });
});
