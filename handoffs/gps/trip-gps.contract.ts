/**
 * Trip GPS contract proposal 1.0.0 — 2026-10-17.
 * Design artifact for BE/mobile; these endpoints/events are NOT implemented yet.
 * All IDs are UUID strings; timestamps are ISO-8601 UTC; distances are meters.
 */
export type UUID = string;
export type ISODateTime = string;
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';
export type TripType = 'PUBLIC' | 'PRIVATE';
export type TripStatus = 'DRAFT' | 'OPEN' | 'FULL' | 'CLOSED' | 'CANCEL_PENDING'
  | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED';
export type Position = [longitude: number, latitude: number];
export interface LineString { type: 'LineString'; coordinates: Position[] }
export type RouteGeometry = LineString | null;

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
  };
  meta: { requestId: string; serverTime: ISODateTime; contractVersion: string };
}

export interface GpsPolicyDto {
  id: UUID;
  versionNo: number;
  sampleIntervalSeconds: number;
  syncIntervalSeconds: number;
  maxBatchSamples: number;
  maxAcceptedAccuracyM: number;
  maxFutureSkewSeconds: number;
  liveLocationMaxAgeSeconds: number;
  staleAfterSeconds: number;
  offlineAfterSeconds: number;
  lateSyncGraceSeconds: number;
  deviationThresholdM: number;
  deviationConsecutiveSamples: number;
  recoveryThresholdM: number;
  recoveryConsecutiveSamples: number;
  signalGapSeconds: number;
  defaultCheckpointRadiusM: number;
  rawLocationRetentionDays: number;
}

export interface PlannedRouteDto {
  trailPlanId: UUID;
  source: 'PERSONAL' | 'SYSTEM';
  sourceTrailId: UUID;
  sequence: number;
  name: string;
  // Original snapshot geometry, not the user's actual LineString.
  geometry: LineString | { type: 'MultiLineString'; coordinates: Position[][] } | null;
}

export interface TripCheckpointDto {
  id: UUID; // TripCheckpoint.id, not SystemCheckpoint.id
  name: string;
  sequence: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isRequired: boolean;
}

export interface GpsContextResponse {
  contractVersion: 'trip-gps/1.0.0';
  tripId: UUID;
  tripType: TripType;
  tripStatus: TripStatus;
  routeSource: 'PERSONAL' | 'SYSTEM';
  routeVersion: number;
  rosterVersion: number;
  routePlans: PlannedRouteDto[];
  activeTrailPlanId: UUID | null;
  checkpointMode: 'NONE' | 'GEOFENCE_ONCE'; // New private PERSONAL/SYSTEM trips require checkpoints; NONE is a fallback for no enabled checkpoints.
  checkpoints: TripCheckpointDto[];
  permissions: {
    canViewGroupLocations: boolean;
    canRecord: boolean;
    cannotRecordReason: string | null;
    canManageTrip: boolean;
  };
  policy: GpsPolicyDto;
  serverTime: ISODateTime;
}

export interface LastLocationDto {
  latitude: number;
  longitude: number;
  accuracyM: number;
  altitudeM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  recordedAt: ISODateTime;
  receivedAt: ISODateTime;
}

export interface CheckpointProgressDto {
  applicable: boolean;
  total: number;
  passed: number;
  percentage: number | null;
  arrivedCheckpointIds: UUID[];
  lastArrival: {
    checkpointId: UUID;
    arrivalAt: ISODateTime;
    distanceToCheckpointM: number;
  } | null;
}

export interface SessionDto {
  id: UUID;
  tripId: UUID;
  userId: UUID;
  clientSessionId: UUID;
  deviceId: string;
  gpsPolicyId: UUID;
  status: SessionStatus;
  version: number; // State-control version, not sample count/memberVersion.
  startedAt: ISODateTime;
  endedAt: ISODateTime | null;
  uploadDeadline: ISODateTime | null;
  sampleCount: number;
  totalDistanceMeters: number | null;
}

export interface MemberStateDto {
  userId: UUID;
  fullName: string;
  avatarUrl: string | null;
  tripRole: 'HOST' | 'LEADER' | 'MEMBER';
  memberVersion: number;
  session: Pick<SessionDto, 'id' | 'status' | 'startedAt' | 'endedAt'
    | 'sampleCount' | 'totalDistanceMeters'> | null; // Prefer open session, else latest.
  lastLocation: LastLocationDto | null;
  locationStatus: 'NO_DATA' | 'LIVE' | 'STALE' | 'OFFLINE' | 'PAUSED' | 'STOPPED';
  lastSyncAt: ISODateTime | null;
  checkpointProgress: CheckpointProgressDto;
  deviation: {
    status: 'UNKNOWN' | 'NORMAL' | 'DEVIATED' | 'NOT_APPLICABLE';
    eventId: UUID | null;
    distanceToRouteMeters: number | null;
    checkedAt: ISODateTime | null;
  };
}

export interface GpsStateResponse {
  tripId: UUID;
  tripStatus: TripStatus;
  routeVersion: number;
  rosterVersion: number;
  serverTime: ISODateTime;
  selfUserId: UUID;
  members: MemberStateDto[];
}

export interface StartSessionRequest {
  clientSessionId: UUID; // Stable across retries.
  deviceId: string; // App installation identifier, not a hardware secret.
}

export interface SessionResponse {
  session: SessionDto;
  policy: GpsPolicyDto; // Frozen policy for this session.
}

export interface GpsSample {
  clientSampleId: UUID;
  recordedAt: ISODateTime;
  latitude: number;
  longitude: number;
  accuracyM: number;
  altitudeM?: number | null;
  speedMps?: number | null;
  headingDeg?: number | null;
}

export interface SamplesRequest { samples: GpsSample[] }
export type SampleRejectCode = 'LOW_ACCURACY' | 'OUTSIDE_ACTIVE_INTERVAL'
  | 'FUTURE_TIMESTAMP' | 'IMPLAUSIBLE_JUMP' | 'BEFORE_SESSION_START'
  | 'AFTER_SESSION_END' | 'SAMPLE_ID_CONFLICT';
export interface SamplesResponse {
  sessionId: UUID;
  acceptedSampleIds: UUID[];
  duplicateSampleIds: UUID[];
  rejectedSamples: { clientSampleId: UUID; code: SampleRejectCode }[];
  sampleCount: number;
  totalDistanceMeters: number | null;
  lastLocation: LastLocationDto | null;
  memberVersion: number;
  routeRebuildPending: boolean;
  serverTime: ISODateTime;
}

export interface SessionControlRequest {
  commandId: UUID;
  expectedVersion: number;
  occurredAt: ISODateTime;
}
export interface FinishSessionRequest extends SessionControlRequest {
  reason: 'USER_FINISHED';
}
export interface FinishSessionResponse {
  session: SessionDto;
  resultStatus: 'PROCESSING' | 'READY' | 'EMPTY' | 'FAILED';
  actualRouteId: UUID | null;
}

export interface GapConnectionDto {
  fromSampleId: UUID;
  toSampleId: UUID;
  fromCoordinateIndex: number;
  toCoordinateIndex: number;
  reason: 'PAUSE' | 'SIGNAL_GAP' | 'BETWEEN_SESSIONS';
  durationSeconds: number;
  straightDistanceMeters: number;
}

export interface ActualRouteResponse {
  tripId: UUID;
  userId: UUID;
  actualRouteId: UUID | null;
  resultStatus: 'NOT_STARTED' | 'RECORDING' | 'PROCESSING' | 'READY' | 'EMPTY' | 'FAILED';
  version: number;
  generatedAt: ISODateTime | null;
  routeGeojson: RouteGeometry; // One continuous LineString when >= 2 valid points.
  pointCount: number;
  distanceMethod: 'SUM_CONSECUTIVE_VALID_POINTS';
  totalDistanceMeters: number | null; // Includes straight connectors per business rule.
  gapConnections: GapConnectionDto[];
  checkpointProgress: CheckpointProgressDto;
  sourceSessionIds: UUID[];
  uploadDeadline: ISODateTime | null;
}

export interface LiveRouteResponse {
  tripId: UUID;
  userId: UUID; // Caller only in v1.
  version: number;
  routeGeojson: RouteGeometry;
  pointCount: number;
  totalDistanceMeters: number | null;
  serverTime: ISODateTime;
}

export interface SocketRequest { requestId: UUID; tripId: UUID }
export type SocketAck<T> =
  | { ok: true; requestId: UUID; data: T }
  | { ok: false; requestId: UUID; error: ErrorBody['error']; meta: ErrorBody['meta'] };
export interface SubscriptionDto {
  tripId: UUID;
  rosterVersion: number;
  serverTime: ISODateTime;
}
export interface EventEnvelope<T> {
  eventId: UUID;
  contractVersion: 'trip-gps/1.0.0';
  tripId: UUID;
  occurredAt: ISODateTime;
  data: T;
}
export interface GpsServerEvents {
  'gps:member.updated': EventEnvelope<{ member: MemberStateDto }>;
  'gps:trip.changed': EventEnvelope<{
    tripStatus: TripStatus; routeVersion: number; rosterVersion: number;
  }>;
  'gps:route.ready': EventEnvelope<{
    userId: UUID; actualRouteId: UUID | null; version: number;
    resultStatus: 'READY' | 'EMPTY';
  }>;
  'gps:route.failed': EventEnvelope<{ userId: UUID; code: string; retryable: boolean }>;
  'gps:access.revoked': EventEnvelope<{ code: string }>;
}

/** REST path suffixes, relative to https://<host>/api/v1. */
export interface RestContract {
  'GET /geo/trips/:tripId/gps/context': { response: GpsContextResponse };
  'GET /geo/trips/:tripId/gps/state': { response: GpsStateResponse };
  'POST /geo/trips/:tripId/gps/sessions': {
    body: StartSessionRequest; response: SessionResponse;
  };
  'GET /geo/trips/:tripId/gps/sessions/:sessionId': { response: SessionResponse };
  'POST /geo/trips/:tripId/gps/sessions/:sessionId/samples': {
    body: SamplesRequest; response: SamplesResponse;
  };
  'POST /geo/trips/:tripId/gps/sessions/:sessionId/pause': {
    body: SessionControlRequest; response: SessionResponse;
  };
  'POST /geo/trips/:tripId/gps/sessions/:sessionId/resume': {
    body: SessionControlRequest; response: SessionResponse;
  };
  'POST /geo/trips/:tripId/gps/sessions/:sessionId/finish': {
    body: FinishSessionRequest; response: FinishSessionResponse;
  };
  'GET /geo/trips/:tripId/gps/my-route': { response: LiveRouteResponse };
  'GET /geo/trips/:tripId/gps/actual-routes/me': { response: ActualRouteResponse };
}
