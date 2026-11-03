export type TripStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'FULL'
  | 'CLOSED'
  | 'CANCEL_PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'INTERRUPTED';

export interface PlannedCheckpoint {
  sourceCheckpointId: string | null;
  name: string;
  description: string | null;
  latitude: string;
  longitude: string;
  radiusMeters: number;
  sequence: number;
  isRequired: boolean;
  isEnabled: boolean;
}

export interface PlannedTrail {
  systemTrailId: string;
  sequence: number;
  snapshotName: string;
  snapshotDifficulty: string;
  snapshotGeojson: unknown;
  snapshotDistanceKm: string | null;
  snapshotElevationGainM: number | null;
  sourceTrailVersion: number | null;
  snapshotCheckpointIds: string[] | unknown;
}

export interface LeaderTripView {
  id: string;
  tripType: string;
  creatorId: string;
  leaderId: string | null;
  destinationId: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  registrationOpenAt?: string | null;
  registrationDeadlineAt?: string | null;
  pickupPointId: string | null;
  capacity: number;
  minCapacity?: number;
  price: string | null;
  priceExplanation: string | null;
  minPax?: number;
  costPlanStatus?: "DRAFT" | "CONFIRMED" | "PUBLISHED" | null;
  includedServices?: string[];
  excludedServices?: string[];
  status: TripStatus;
  version: number;
  publishedAt: string | null;
  closedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  checkpoints: PlannedCheckpoint[];
  trails: PlannedTrail[];
}

export interface CreateLeaderPublicTripInput {
  destinationId: string;
  title: string;
  description?: string | null;
  priceExplanation?: string | null;
  startAt: string;
  endAt: string;
  registrationOpenAt?: string | null;
  registrationDeadlineAt?: string | null;
  pickupPointId: string;
  capacity: number;
  minCapacity?: number;
  price: string;
}

export interface UpdateLeaderPublicTripInput {
  expectedVersion: number;
  destinationId?: string;
  title?: string;
  description?: string | null;
  priceExplanation?: string | null;
  startAt?: string;
  endAt?: string;
  registrationOpenAt?: string | null;
  registrationDeadlineAt?: string | null;
  pickupPointId?: string;
  capacity?: number;
  minCapacity?: number;
  price?: string;
}

export interface SetTripCheckpointsInput {
  expectedVersion: number;
  checkpointIds: string[];
}

export interface SetTripTrailsInput {
  expectedVersion: number;
  trailIds: string[];
}

export interface PublishTripInput {
  expectedVersion: number;
}

export interface CancelTripInput {
  expectedVersion: number;
  reason: string;
  evidenceUrls?: string[];
}

export interface LeaderTripPaginationQuery {
  page?: number;
  pageSize?: number;
  destinationId?: string;
}

export interface Issue {
  code: string;
  field: string;
  message: string;
}

export interface TripReadinessResult {
  canPublish: boolean;
  version: number;
  issues: Issue[];
}

export interface TrailSuggestion {
  id: string;
  destinationId: string;
  name: string;
  difficulty: string;
  status: string;
  version: number;
  routeGeojson: unknown;
  distanceKm: string;
  elevationGainM: number | null;
  checkpointIds: string[];
  canAppend: boolean;
  coveredCheckpointIds: string[];
}

export interface ScheduleConflictItem {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
}

export interface ScheduleConflictResult {
  hasConflict: boolean;
  conflicts: ScheduleConflictItem[];
}

export interface ScheduleConflictQuery {
  startAt: string;
  endAt: string;
  excludeTripId?: string;
}

export interface TripOptionItem {
  id: string;
  name: string;
}

export interface LeaderCheckpointOption {
  id: string;
  destinationId: string;
  name: string;
  description: string | null;
  latitude: string;
  longitude: string;
  defaultRadiusMeters: number;
  status: string;
}

export interface LeaderTrailDetail {
  id: string;
  destinationId: string;
  name: string;
  difficulty: string;
  status: string;
  version: number;
  routeGeojson: unknown;
  distanceKm: string;
  elevationGainM: number | null;
  checkpointIds: string[];
}

export interface LeaderParticipantItem {
  id: string;
  bookingId: string;
  bookingStatus: 'CONFIRMED' | 'PARTIAL_CHECKIN' | 'CHECKED_IN' | 'COMPLETED' | 'NO_SHOW';
  fullName: string;
  phone: string | null;
  dateOfBirth: string | null;
  idDocumentNo: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  participantStatus: 'ACTIVE' | 'NO_SHOW' | 'COMPLETED';
  checkinStatus: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'NO_SHOW';
  checkinMethod: 'QR' | 'MANUAL' | null;
  checkedInAt: string | null;
  checkedInBy: string | null;
  isLinkedAccount: boolean;
  linkedUserDisplay: string | null;
  buyerDisplay: string;
  buyerPhone: string | null;
  pickupPoint: { id: string; name: string; address: string } | null;
}

export interface LeaderParticipantsSummary {
  capacity: number;
  minPax: number;
  totalParticipants: number;
  checkedInCount: number;
  notCheckedInCount: number;
  noShowCount: number;
  progressPercent: number;
}

export interface LeaderParticipantsResponse {
  trip: {
    id: string;
    title: string;
    status: string;
    startAt: string;
    endAt: string;
    capacity: number;
    minPax: number;
  };
  summary: LeaderParticipantsSummary;
  items: LeaderParticipantItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface LeaderCheckinResult {
  alreadyCheckedIn: boolean;
  replayed: boolean;
  bookingStatus: 'CONFIRMED' | 'PARTIAL_CHECKIN' | 'CHECKED_IN' | 'NO_SHOW';
  bookingVersion: number;
  participant: LeaderParticipantItem;
  summary: LeaderParticipantsSummary;
}
