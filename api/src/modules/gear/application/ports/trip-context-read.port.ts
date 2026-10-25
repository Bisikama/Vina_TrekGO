export const TRIP_CONTEXT_READ_PORT = Symbol('TRIP_CONTEXT_READ_PORT');

export interface TripContextFactData {
  tripId: string;
  status: string;
  startAt: Date;
  endAt: Date;
  days: number;
  difficulty: number;
  terrain: string[];
  destination?: string;
  contextVersion?: string;
  sourceReferences?: {
    tripId: string;
    trailId?: string;
    trailPlanId?: string;
    version?: number;
  };
}

export interface TripContextReadPort {
  /**
   * Retrieves canonical trip facts (days, difficulty, terrain) and validates
   * trip eligibility and user active membership/leader policy.
   * Throws typed errors:
   * - GEAR_TRIP_NOT_FOUND (404) if trip doesn't exist
   * - GEAR_TRIP_NOT_ELIGIBLE (400) if trip is CANCELLED, COMPLETED, INTERRUPTED, or past endAt
   * - GEAR_FORBIDDEN (403) if user is not an active member, creator, or leader
   * - GEAR_NEEDS_CONTEXT (400) if required official facts (difficulty, terrain, days) are missing
   */
  getTripContext(tripId: string, userId: string): Promise<TripContextFactData>;

  /**
   * Retrieves historical trip facts for past/ended trips based on plan ownership.
   * Allows reading history for plans associated with ended trips (CANCELLED, COMPLETED, INTERRUPTED)
   * without throwing GEAR_TRIP_NOT_ELIGIBLE.
   */
  getHistoricalTripContext(tripId: string, userId: string, planId: string): Promise<TripContextFactData>;
}
