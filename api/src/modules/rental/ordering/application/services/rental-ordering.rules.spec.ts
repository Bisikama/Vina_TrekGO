import {
  calculateChargedDays,
  calculateDepositPerUnit,
  calculateOccupiedWindow,
  evaluateRentalEligibility,
  normalizeQuoteItems,
  parseWholeVnd,
} from './rental-ordering.rules';
import type { RentalEligibilityContext } from '../ports/rental-context.port';

function createContext(): RentalEligibilityContext {
  return {
    booking: {
      id: 'booking-1',
      ownerUserId: 'user-1',
      tripId: 'trip-1',
      status: 'CONFIRMED',
      currency: 'VND',
    },
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
    recipientOptions: [],
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
      quoteTtlMinutes: 15,
      cutoffHoursBeforeTrip: 25,
      prepBufferMinutes: 360,
      returnBufferMinutes: 360,
      cleaningBufferMinutes: 480,
      snapshot: {
        policyCode: 'rental-policy',
        versionNo: 2,
        quoteTtlMinutes: 15,
        cutoffHoursBeforeTrip: 25,
        prepBufferMinutes: 360,
        returnBufferMinutes: 360,
        cleaningBufferMinutes: 480,
        cancellationRules: {},
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveTo: null,
      },
    },
  };
}

describe('rental-ordering.rules', () => {
  it('cho phép Booking CONFIRMED của PUBLIC Trip trước cutoff', () => {
    const result = evaluateRentalEligibility(
      createContext(),
      new Date('2026-10-08T00:00:00Z'),
    );

    expect(result).toEqual({ eligible: true, reason: null });
  });

  it('trả eligible=false khi Booking chưa CONFIRMED', () => {
    const context = createContext();
    context.booking.status = 'PENDING_PAYMENT';

    expect(
      evaluateRentalEligibility(context, new Date('2026-10-08T00:00:00Z')),
    ).toEqual({
      eligible: false,
      reason: 'BOOKING_NOT_RENTAL_ELIGIBLE',
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

  it('tách occupied window khỏi billing window', () => {
    const window = calculateOccupiedWindow(createContext());

    expect(window.occupiedFrom.toISOString()).toBe('2026-10-09T18:00:00.000Z');
    expect(window.occupiedUntil.toISOString()).toBe('2026-10-13T02:00:00.000Z');
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
