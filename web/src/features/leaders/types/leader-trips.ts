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
  pickupPointId: string | null;
  capacity: number;
  price: string | null;
  status: TripStatus;
  version: number;
  publishedAt: string | null;
  checkpoints: PlannedCheckpoint[];
  trails: PlannedTrail[];
}

export interface CreateLeaderPublicTripInput {
  destinationId: string;
  title: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  pickupPointId: string;
  capacity: number;
  price: string;
}

export interface UpdateLeaderPublicTripInput {
  expectedVersion: number;
  destinationId?: string;
  title?: string;
  description?: string | null;
  startAt?: string;
  endAt?: string;
  pickupPointId?: string;
  capacity?: number;
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
