/**
 * Trip GPS Types & Contract — Version 1.0.0
 * Reflects docs/GPS_IN_TRIP.md specification for Public & Private trips.
 */

export type UUID = string;
export type ISODateTime = string;
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';
export type TripType = 'PUBLIC' | 'PRIVATE';
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

export type Position = [longitude: number, latitude: number];

export interface LineString {
  type: 'LineString';
  coordinates: Position[];
}

export interface MultiLineString {
  type: 'MultiLineString';
  coordinates: Position[][];
}

export type RouteGeometry = LineString | null;

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | { field: string; message: string }[];
    retryable: boolean;
  };
  meta: {
    requestId: string;
    serverTime: ISODateTime;
    contractVersion: string;
  };
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
  geometry: LineString | MultiLineString | null;
}

export interface TripCheckpointDto {
  id: UUID;
  name: string;
  sequence: number;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isRequired: boolean;
}

export interface GpsContextResponse {
  capabilities?: GpsSyncLimits & { supportedSyncProtocols: number[]; socketPublishSupported: boolean };
  contractVersion: 'trip-gps/1.0.0';
  tripId: UUID;
  tripType: TripType;
  tripStatus: TripStatus;
  routeSource: 'PERSONAL' | 'SYSTEM';
  routeVersion: number;
  rosterVersion: number;
  routePlans: PlannedRouteDto[];
  activeTrailPlanId: UUID | null;
  checkpointMode: 'NONE' | 'GEOFENCE_ONCE';
  checkpoints: TripCheckpointDto[];
  permissions: {
    canStartNewSession?: boolean;
    canContinueExistingSession?: boolean;
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
  recordingIntervals?: { start: ISODateTime; end: ISODateTime | null }[];
  id: UUID;
  tripId: UUID;
  userId: UUID;
  clientSessionId: UUID;
  deviceId: string;
  gpsPolicyId: UUID;
  status: SessionStatus;
  version: number;
  startedAt: ISODateTime;
  endedAt: ISODateTime | null;
  uploadDeadline: ISODateTime | null;
  sampleCount: number;
  totalDistanceMeters: number | null;
}

export interface MemberStateDto {
  connectionStatus?: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  locationFreshness?: 'NO_DATA' | 'STALE' | 'FRESH';
  locationVersion?: number;
  presenceVersion?: number;
  userId: UUID;
  fullName: string;
  avatarUrl: string | null;
  tripRole: 'HOST' | 'LEADER' | 'MEMBER';
  memberVersion: number;
  session: Pick<
    SessionDto,
    'id' | 'status' | 'startedAt' | 'endedAt' | 'sampleCount' | 'totalDistanceMeters'
  > | null;
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
  protocolVersion?: 2;
  clientSessionId: UUID;
  deviceId: string;
}

export interface SessionResponse {
  protocolVersion?: 2;
  limits?: GpsSyncLimits;
  session: SessionDto;
  policy: GpsPolicyDto;
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

export interface SamplesRequest {
  samples: GpsSample[];
}

export type SampleRejectCode =
  | 'LOW_ACCURACY'
  | 'OUTSIDE_ACTIVE_INTERVAL'
  | 'FUTURE_TIMESTAMP'
  | 'IMPLAUSIBLE_JUMP'
  | 'BEFORE_SESSION_START'
  | 'AFTER_SESSION_END'
  | 'SAMPLE_ID_CONFLICT';

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
  resultStatus:
    | 'NOT_STARTED'
    | 'RECORDING'
    | 'PROCESSING'
    | 'READY'
    | 'EMPTY'
    | 'FAILED';
  version: number;
  generatedAt: ISODateTime | null;
  routeGeojson: RouteGeometry;
  pointCount: number;
  distanceMethod: 'SUM_CONSECUTIVE_VALID_POINTS';
  totalDistanceMeters: number | null;
  gapConnections: GapConnectionDto[];
  checkpointProgress: CheckpointProgressDto;
  sourceSessionIds: UUID[];
  /** Optional so older servers without these fields still parse. */
  startedAt?: ISODateTime | null;
  movingDurationSeconds?: number | null;
  uploadDeadline: ISODateTime | null;
}

export interface LiveRouteResponse {
  tripId: UUID;
  userId: UUID;
  version: number;
  routeGeojson: RouteGeometry;
  pointCount: number;
  totalDistanceMeters: number | null;
  serverTime: ISODateTime;
}

export interface SocketRequest {
  requestId: UUID;
  tripId: UUID;
}

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

export interface MemberUpdatedEventData {
  member: MemberStateDto;
}

export interface TripChangedEventData {
  tripStatus: TripStatus;
  routeVersion: number;
  rosterVersion: number;
}

export interface RouteReadyEventData {
  userId: UUID;
  actualRouteId: UUID | null;
  version: number;
  resultStatus: 'READY' | 'EMPTY';
}

export interface RouteFailedEventData {
  userId: UUID;
  code: string;
  retryable: boolean;
}

export interface AccessRevokedEventData {
  code: string;
}

export interface GpsSyncLimits {
  maxBatchSamples: number;
  maxBodyBytes: number;
  maxCommandsPerRequest: number;
  maxManifestEntriesPerPage: number;
  maxSnapshotSamples: number;
  publishMinIntervalSeconds: number;
  publishMinDistanceM: number;
  publishMovingMaxIntervalSeconds: number;
  retryDelaysSeconds: number[];
}
export type LocalSyncStatus = 'PENDING' | 'SYNCING' | 'WAITING_NETWORK' | 'PROCESSING' | 'SYNCED' | 'NEEDS_ATTENTION';
export interface SyncCommand {
  commandId: string;
  sequence: number;
  action: 'PAUSE' | 'RESUME' | 'FINISH';
  occurredAt: string;
}
export interface SyncMetadata {
  requestId: string;
  revision: number;
  baseMetadataRevision: number;
  commands: SyncCommand[];
  recordingStatus: SessionStatus;
  endedAt?: string | null;
}
export interface SyncBatch {
  batchId: string;
  payloadHash: string;
  metadataRevision: number;
  snapshotRevision: number;
  samples: GpsSample[];
}
export interface ManifestEntry { batchId: string; payloadHash: string; sampleCount: number }
export interface SyncManifest {
  manifestId: string;
  snapshotRevision: number;
  pageIndex: number;
  pageCount: number;
  pageHash: string;
  entries: ManifestEntry[];
}
export interface SyncComplete {
  completionId: string;
  snapshotRevision: number;
  metadataRevision: number;
  snapshotMaxSequence: number;
  final: true;
  expectedSampleCount: number;
  manifestId: string;
  manifestHash: string;
  endedAt: string;
}
export interface SyncStatus {
  sessionId: string;
  metadataRevision: number;
  receivedSnapshotRevision: number;
  processedSnapshotRevision: number;
  syncStatus: 'OPEN' | 'RECEIVING' | 'FINALIZE_PENDING' | 'PROCESSING' | 'COMPLETE' | 'NEEDS_ATTENTION';
  acceptedCount: number;
  rejectedCount: number;
  missingBatchIds: string[];
  nextCursor: number | null;
  resultStatus: string | null;
  actualRouteId: string | null;
  lastError: { code: string; retryable: boolean; nextRetryAt: string } | null;
  attempts: number;
  serverTime: string;
}
export interface LocationUpdated { userId: string; sessionId: string; sequence: number; locationVersion: number; location: LastLocationDto }
export interface PresenceUpdated { userId: string; connectionStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN'; presenceVersion: number }
