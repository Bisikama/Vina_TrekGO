export type RecordingStatus =
  | "RECORDING"
  | "PAUSED"
  | "STOPPED_LOCAL"
  | "PENDING_SYNC"
  | "SYNC_FAILED"
  | "PROCESSING"
  | "PROCESSING_FAILED"
  | "READY";

export type RejectReason =
  | "LOW_ACCURACY"
  | "SPEED_OUTLIER"
  | "INVALID_COORDS"
  | "GPS_JUMP"
  | "GPS_JITTER"
  | "STALE_LOCATION"
  | "INVALID_TIME";

export function mapRejectReason(reason?: string): RejectReason | null {
  if (!reason) return null;
  switch (reason) {
    case "LOW_ACCURACY":
      return "LOW_ACCURACY";
    case "SPEED_OUTLIER":
      return "SPEED_OUTLIER";
    case "INVALID_COORDINATE":
    case "INVALID_COORDS":
      return "INVALID_COORDS";
    case "GPS_JUMP":
      return "GPS_JUMP";
    case "GPS_JITTER":
      return "GPS_JITTER";
    case "STALE_LOCATION":
      return "STALE_LOCATION";
    case "INVALID_TIME":
      return "INVALID_TIME";
    default:
      return "GPS_JUMP";
  }
}

export interface RawGpsSample {
  clientSampleId: string; // UUID ổn định qua retry
  clientRecordingId: string; // UUID local, ổn định qua restart
  latitude: number;
  longitude: number;
  recordedAt: string; // ISO 8601 UTC
  accuracyM: number | null;
  altitudeM: number | null; // giá trị gốc từ location.coords.altitude
  altitudeAccuracyM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  segmentId: number;
  accepted: boolean; // quyết định filter trên mobile
  rejectReason?: RejectReason | null;
}

export interface LiveGpsPoint {
  clientSampleId: string;
  latitude: number;
  longitude: number;
  segmentId: number;
  elevationSmoothedM: number | null; // CHỈ UI, không ghi đè raw altitudeM
  recordedAt: string;
}

export interface LocalRecording {
  ownerId?: string | null;
  clientRecordingId: string;
  serverRecordingId: string | null;
  status: RecordingStatus;
  startedAt: string;
  endedAt: string | null;
  nextSegmentId: number;
  lastSyncedAt: string | null;
  serverPersonalTrailId: string | null;
  localTrailId?: string | null;
  duration?: string | null;
  elapsedSeconds?: number | null;
}

export interface LocalCheckpoint {
  clientCheckpointId: string;
  clientRecordingId: string;
  name: string;
  order: number;
  latitude: number | null;
  longitude: number | null;
  recordedAt: string;
  distanceFromStartKm: number | null;
  elevationLiveM: number | null;
}

export interface SyncOutboxItem {
  id: string;
  clientRecordingId: string;
  operation:
    | "CREATE_RECORDING"
    | "BATCH_POINTS"
    | "UPDATE_STATUS"
    | "FINISH_RECORDING"
    | "CREATE_TRAIL";
  payloadJson: string;
  state: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  attemptCount: number;
  nextRetryAt: string | null;
  createdAt: string;
}
