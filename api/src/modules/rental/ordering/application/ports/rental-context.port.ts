export interface RentalRecipientOption {
  participantId: string;
  userId: string | null;
  displayName: string;
  phone: string | null;
  status: string;
}

export interface RentalPointContext {
  id: string;
  name: string;
  address: string;
  scheduledAt: Date;
}

export interface RentalTripContext {
  id: string;
  name: string;
  status: string;
  tripType: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  difficulty: string | null;
  weatherSummary: string | null;
  rainProbabilityPercent: number | null;
}

export interface RentalPolicySnapshot {
  policyCode: string;
  versionNo: number;
  quoteTtlMinutes: number;
  cutoffHoursBeforeTrip: number;
  prepBufferMinutes: number;
  returnBufferMinutes: number;
  cleaningBufferMinutes: number;
  cancellationRules: unknown;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface RentalPolicyContext {
  id: string;
  policyCode: string;
  versionNo: number;
  quoteTtlMinutes: number;
  cutoffHoursBeforeTrip: number;
  prepBufferMinutes: number;
  returnBufferMinutes: number;
  cleaningBufferMinutes: number;
  snapshot: RentalPolicySnapshot;
}

export interface RentalEligibilityContext {
  booking: {
    id: string;
    ownerUserId: string;
    tripId: string;
    status: string;
    currency: string;
  };
  trip: RentalTripContext;
  recipientOptions: RentalRecipientOption[];
  pickup: RentalPointContext;
  dropoff: RentalPointContext;
  rentalCutoffAt: Date;
  contextVersion: number;
  existingOpenOrderId: string | null;
  activePolicy: RentalPolicyContext;
}

export const RENTAL_CONTEXT_PORT = Symbol('RENTAL_CONTEXT_PORT');

export interface RentalContextPort {
  /**
   * Đọc snapshot context cần cho B1.
   * `now` được truyền từ Use Case để việc test cutoff/policy có thể deterministic.
   */
  getByBookingId(bookingId: string, now: Date): Promise<RentalEligibilityContext | null>;
}