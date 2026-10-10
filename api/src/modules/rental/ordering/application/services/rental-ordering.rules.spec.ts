import {
  calculateChargedDays,
  calculateDepositPerUnit,
  calculateOccupiedWindow,
  evaluateRentalEligibility,
  normalizeQuoteItems,
  resolveRentalReturn,
  parseWholeVnd,
} from './rental-ordering.rules';
import type { RentalEligibilityContext } from '../ports/rental-context.port';

function createContext(): RentalEligibilityContext {
  return {
    userId: 'user-1', membershipRef: 'member-1', membershipStatus: 'ACTIVE', membershipRole: 'MEMBER', rentalEligible: true, ineligibleReason: null, bookingId: null,
    trip: {
      id: 'trip-1',
      name: 'Trek test',
      status: 'OPEN',
      tripType: 'PUBLIC',
      startAt: new Date('2026-10-10T01:00:00Z'),
      endAt: new Date('2026-10-12T10:00:00Z'),
      timezone: 'Asia/Ho_Chi_Minh',
      difficulty: 'MEDIUM',
      weatherSummary: 'Có khả năng mưa nhẹ',
      rainProbabilityPercent: 40,
    },
    recipientOptions: [{ memberId: 'member-1', userId: 'user-1', displayName: 'A', phone: null, status: 'ACTIVE' }],
    returnOptions: [{ id: 'return-extra', pointId: 'dropoff-1', pointName: 'Return', method: 'SCHEDULED', available: true, windowStart: new Date('2026-10-12T12:00:00Z'), windowEnd: new Date('2026-10-15T12:00:00Z') }],
    pickup: {
      id: 'pickup-1',
      name: 'Pickup',
      address: 'HCM',
      scheduledAt: new Date('2026-10-10T00:00:00Z'),
    },
    dropoff: {
      id: 'dropoff-1',
      name: 'Dropoff',
      address: 'HCM',
      scheduledAt: new Date('2026-10-12T12:00:00Z'),
    },
    rentalCutoffAt: new Date('2026-10-09T00:00:00Z'),
    contextVersion: 4,
    existingOpenOrderId: null,
    activePolicy: {
      id: 'policy-1',
      policyCode: 'rental-policy',
      versionNo: 2,
      currency: 'VND', dayCountMode: 'CEIL_24H', maxRentalAfterTripHours: 48, extensionRequestCutoffMinutes: 120, extensionHoldMinutes: 15,
      quoteTtlMinutes: 15,
      paymentHoldMinutes: 15,
      freeCancellationHours: 24,
      cutoffHoursBeforeTrip: 25,
      prepBufferMinutes: 720,
      returnBufferMinutes: 1440,
      cleaningBufferMinutes: 0,
      deepInspectionBufferMinutes: 2880,
      overdueReviewMinutes: null,
      snapshot: {
        policyCode: 'rental-policy',
        versionNo: 2,
        currency: 'VND', dayCountMode: 'CEIL_24H', maxRentalAfterTripHours: 48, extensionRequestCutoffMinutes: 120, extensionHoldMinutes: 15,
        quoteTtlMinutes: 15,
        paymentHoldMinutes: 15,
        freeCancellationHours: 24,
        cutoffHoursBeforeTrip: 25,
        prepBufferMinutes: 720,
        returnBufferMinutes: 1440,
        cleaningBufferMinutes: 0,
      deepInspectionBufferMinutes: 2880,
        overdueReviewMinutes: null,
        cancellationRules: {},
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
      },
    },
  };
}

describe('rental-ordering.rules', () => {
  it('cho phép Trip Member ACTIVE trên PUBLIC Trip trước cutoff', () => {
    const result = evaluateRentalEligibility(
      createContext(),
      new Date('2026-10-08T00:00:00Z'),
    );

    expect(result).toEqual({ eligible: true, reason: null });
  });

  it('trả eligible=false khi membership bị khóa', () => {
    const context = createContext();
    context.membershipStatus = 'SUSPENDED';

    expect(
      evaluateRentalEligibility(context, new Date('2026-10-08T00:00:00Z')),
    ).toEqual({
      eligible: false,
      reason: 'TRIP_MEMBERSHIP_NOT_ELIGIBLE',
    });
  });

  it('trả RENTAL_CUTOFF_PASSED khi đã tới cutoff', () => {
    const context = createContext();

    expect(
      evaluateRentalEligibility(context, new Date('2026-10-09T00:00:00Z')),
    ).toEqual({
      eligible: false,
      reason: 'RENTAL_CUTOFF_PASSED',
    });
  });

  it('PRIVATE Trip member hợp lệ không đòi Booking', () => {
    const context = createContext(); context.trip.tripType = 'PRIVATE';
    context.bookingId = null;
    expect(evaluateRentalEligibility(context, new Date('2026-10-08T00:00:00Z')).eligible).toBe(true);
  });

  it('trả sau chuyến phải có phương án logistics server cho phép', () => {
    const context = createContext();
    expect(resolveRentalReturn(context, new Date('2026-10-14T00:00:00Z'), 'return-extra').pointId).toBe('dropoff-1');
    expect(() => resolveRentalReturn(context, new Date('2026-10-14T00:00:00Z'))).toThrow();
    expect(() => resolveRentalReturn(context, new Date('2026-10-11T00:00:00Z'))).toThrow();
  });

  it('tách occupied window khỏi billing window', () => {
    const window = calculateOccupiedWindow(createContext());

    expect(window.occupiedFrom.toISOString()).toBe('2026-10-09T12:00:00.000Z');
    expect(window.occupiedUntil.toISOString()).toBe('2026-10-13T12:00:00.000Z');
  });

  it('tính chargedDays bằng ceil 24h baseline', () => {
    expect(
      calculateChargedDays(
        new Date('2026-10-10T01:00:00Z'),
        new Date('2026-10-12T10:00:00Z'),
      ),
    ).toBe(3);
  });

  it('gộp product bị lặp mà không tạo quota theo participant', () => {
    expect(
      normalizeQuoteItems([
        { productId: 'p1', quantity: 1 },
        { productId: 'p1', quantity: 2 },
      ]),
    ).toEqual([{ productId: 'p1', quantity: 3 }]);
  });

  it('không dùng floating point khi tính fixed deposit', () => {
    expect(parseWholeVnd('120000.00')).toBe(120000n);
    expect(
      calculateDepositPerUnit({
        depositPolicyType: 'FIXED',
        depositValue: '500000.00',
        replacementValue: '2000000.00',
      }),
    ).toBe(500000n);
  });

  it('tính percentage deposit bằng basis points', () => {
    expect(
      calculateDepositPerUnit({
        depositPolicyType: 'PERCENT_REPLACEMENT_VALUE',
        depositValue: '25.00',
        replacementValue: '2000000.00',
      }),
    ).toBe(500000n);
  });
});
