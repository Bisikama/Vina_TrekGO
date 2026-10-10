/** Read-only Area A Trip rental context: independent from Booking. */
export interface RentalRecipientOption {
  memberId: string
  userId: string
  displayName: string
  phone: string | null
  status: string
}
export interface RentalPointContext {
  id: string
  name: string
  address: string
  scheduledAt: Date
}
export interface RentalReturnOption {
  id: string
  pointId: string
  pointName: string
  method: string
  available: boolean
  windowStart: Date
  windowEnd: Date
}
export interface RentalTripContext {
  id: string
  name: string
  status: string
  tripType: string
  startAt: Date
  endAt: Date
  timezone: string
  difficulty: string | null
  weatherSummary: string | null
  rainProbabilityPercent: number | null
}
export interface RentalPolicySnapshot {
  policyCode: string
  versionNo: number
  currency: string
  dayCountMode: 'CEIL_24H'
  quoteTtlMinutes: number
  paymentHoldMinutes: number
  freeCancellationHours: number
  cutoffHoursBeforeTrip: number
  prepBufferMinutes: number
  returnBufferMinutes: number
  cleaningBufferMinutes: number
  overdueReviewMinutes: number | null
  maxRentalAfterTripHours: number | null
  extensionRequestCutoffMinutes: number | null
  extensionHoldMinutes: number | null
  maxExtensionCount?: number | null
  maxTotalRentalDays?: number | null
  deepInspectionBufferMinutes?: number | null
  cancellationRules: unknown
  effectiveFrom: string
  effectiveTo: string | null
}
export interface RentalPolicyContext extends Omit<
  RentalPolicySnapshot,
  'cancellationRules' | 'effectiveFrom' | 'effectiveTo'
> {
  id: string
  snapshot: RentalPolicySnapshot
}
export interface RentalEligibilityContext {
  userId: string
  membershipRef: string
  membershipStatus: string
  membershipRole: string
  rentalEligible: boolean
  ineligibleReason: string | null
  bookingId: string | null // provenance only; NEVER authorization
  trip: RentalTripContext
  recipientOptions: RentalRecipientOption[]
  pickup: RentalPointContext
  dropoff: RentalPointContext
  returnOptions: RentalReturnOption[] // available, server-issued logistics options
  rentalCutoffAt: Date
  contextVersion: number
  existingOpenOrderId: string | null
  activePolicy: RentalPolicyContext
}
export const RENTAL_CONTEXT_PORT = Symbol('RENTAL_CONTEXT_PORT')
export interface RentalContextPort {
  getByTripId(tripId: string, userId: string, now: Date): Promise<RentalEligibilityContext | null>
}
