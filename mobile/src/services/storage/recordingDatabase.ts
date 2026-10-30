import { queuePersonalTrailWrite, personalTrailWriteAllowed } from "./personalTrailWrites";
import {
  LocalCheckpoint,
  LocalRecording,
  PersonalTrail,
  RawGpsSample,
  RecordingStatus,
  SyncOutboxItem,
} from "@/types";
import { readStoredAuth } from "@/features/auth/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { STORAGE_KEYS } from "./keys";

export function createDeterministicUuid(source: string): string {
  let h1 = 0xdeadbeef ^ source.length;
  let h2 = 0x41c6ce57 ^ source.length;
  let h3 = 0xc0decafe ^ source.length;
  let h4 = 0x9e3779b9 ^ source.length;

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
    h3 = Math.imul(h3 ^ code, 2246822507);
    h4 = Math.imul(h4 ^ code, 3266489909);
  }

  const words = [
    (h1 ^ (h1 >>> 16)) >>> 0,
    (h2 ^ (h2 >>> 13)) >>> 0,
    (h3 ^ (h3 >>> 16)) >>> 0,
    (h4 ^ (h4 >>> 13)) >>> 0,
  ];
  const bytes = words.flatMap((word) => [
    word >>> 24,
    word >>> 16,
    word >>> 8,
    word,
  ]).map((value) => value & 0xff);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = initializeDatabase();

  try {
    dbInstance = await dbPromise;
    return dbInstance;
  } catch (error) {
    dbPromise = null;
    throw error;
  }
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("trekgo_recordings.db");

  // Thiết lập WAL mode cho hiệu năng ghi cao và bảo toàn dữ liệu
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS personal_trail_cache (
      owner_id TEXT PRIMARY KEY,
      trails_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_recordings (
      client_recording_id TEXT PRIMARY KEY,
      server_recording_id TEXT,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      next_segment_id INTEGER NOT NULL DEFAULT 0,
      server_personal_trail_id TEXT,
      last_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS raw_gps_samples (
      client_sample_id TEXT PRIMARY KEY,
      client_recording_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      accuracy_m REAL,
      altitude_m REAL,
      altitude_accuracy_m REAL,
      speed_mps REAL,
      heading_deg REAL,
      segment_id INTEGER NOT NULL DEFAULT 0,
      accepted INTEGER NOT NULL,
      reject_reason TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (client_recording_id) REFERENCES local_recordings(client_recording_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_samples_pending
      ON raw_gps_samples(client_recording_id, synced, recorded_at);

    CREATE TABLE IF NOT EXISTS local_checkpoints (
      client_checkpoint_id TEXT PRIMARY KEY,
      client_recording_id TEXT NOT NULL,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      latitude REAL,
      longitude REAL,
      recorded_at TEXT NOT NULL,
      distance_from_start_km REAL,
      elevation_live_m REAL,
      FOREIGN KEY (client_recording_id) REFERENCES local_recordings(client_recording_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      client_recording_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'PENDING',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (client_recording_id) REFERENCES local_recordings(client_recording_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS personal_trails (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      region TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      distance_km REAL NOT NULL,
      elevation_gain_m REAL NOT NULL,
      duration TEXT NOT NULL,
      terrain_type TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'PRIVATE',
      verification_status TEXT NOT NULL DEFAULT 'DRAFT',
      rejection_reason TEXT,
      gps_segments_json TEXT NOT NULL,
      checkpoints_json TEXT NOT NULL DEFAULT '[]',
      client_recording_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (client_recording_id) REFERENCES local_recordings(client_recording_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_personal_trails_owner
      ON personal_trails(owner_id);

    -- Dọn sạch bảng tạm nếu còn sót lại
    DROP TABLE IF EXISTS personal_trails_v2;
  `);

  // Migration tường minh để không che khuất lỗi SQLite không liên quan.
  const recordingColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(local_recordings)",
  );
  const existingColumns = new Set(recordingColumns.map((column) => column.name));
  if (!existingColumns.has("owner_id")) {
    await db.execAsync("ALTER TABLE local_recordings ADD COLUMN owner_id TEXT");
    // Recover ownership only from an existing trail; never claim unknown data for the current login.
    await db.execAsync(
      `UPDATE local_recordings SET owner_id = (
        SELECT MIN(pt.owner_id) FROM personal_trails pt
        WHERE pt.client_recording_id = local_recordings.client_recording_id
        HAVING COUNT(DISTINCT pt.owner_id) = 1
      ) WHERE owner_id IS NULL`,
    );
  }
  if (!existingColumns.has("duration")) {
    await db.execAsync("ALTER TABLE local_recordings ADD COLUMN duration TEXT");
  }
  if (!existingColumns.has("elapsed_seconds")) {
    await db.execAsync(
      "ALTER TABLE local_recordings ADD COLUMN elapsed_seconds INTEGER",
    );
  }
  if (!existingColumns.has("local_trail_id")) {
    await db.execAsync(
      "ALTER TABLE local_recordings ADD COLUMN local_trail_id TEXT",
    );
  }

  // Các bản app cũ dùng recordingId:timestamp:lat:lng làm clientSampleId.
  // Backend yêu cầu UUID, vì vậy đổi khóa cũ một lần trước khi outbox retry.
  const legacySampleIds = await db.getAllAsync<{
    client_sample_id: string;
    client_recording_id: string;
  }>("SELECT client_sample_id, client_recording_id FROM raw_gps_samples");
  const migratedRecordingIds = new Set<string>();
  for (const row of legacySampleIds) {
    if (isUuid(row.client_sample_id)) continue;
    const migratedId = createDeterministicUuid(row.client_sample_id);
    await db.runAsync(
      "UPDATE raw_gps_samples SET client_sample_id = ? WHERE client_sample_id = ?",
      [migratedId, row.client_sample_id],
    );
    migratedRecordingIds.add(row.client_recording_id);
  }

  // Cho phép auto-sync chạy lại ngay cả khi batch cũ đã chạm giới hạn retry.
  for (const recordingId of migratedRecordingIds) {
    await db.runAsync(
      `UPDATE sync_outbox
       SET state = 'PENDING', attempt_count = 0, next_retry_at = NULL
       WHERE client_recording_id = ?
         AND state = 'FAILED'
         AND operation IN ('BATCH_POINTS', 'FINISH_RECORDING', 'CREATE_TRAIL')`,
      [recordingId],
    );
  }

  return db;
}

function rowToPersonalTrail(row: any): PersonalTrail {
  let gpsSegments: [number, number, number?][][] = [];
  if (row.gps_segments_json) {
    try {
      gpsSegments = JSON.parse(row.gps_segments_json);
    } catch {
      gpsSegments = [];
    }
  }

  let checkpoints: any[] = [];
  try {
    checkpoints = JSON.parse(row.checkpoints_json || "[]");
  } catch {
    checkpoints = [];
  }

  // Tự động sinh mảng phẳng gpsRoute từ gpsSegments để các component hiển thị tiện sử dụng
  const gpsRoute: [number, number, number?][] = [];
  for (const seg of gpsSegments) {
    gpsRoute.push(...seg);
  }

  let duration = row.duration;
  if (!duration || duration === "0 phút" || duration === "00:00") {
    if (row.created_at && row.updated_at) {
      const start = new Date(row.created_at).getTime();
      const end = new Date(row.updated_at).getTime();
      if (!isNaN(start) && !isNaN(end) && end > start) {
        const diffSec = Math.floor((end - start) / 1000);
        const mins = Math.round(diffSec / 60);
        duration = mins >= 60
          ? `${Math.floor(mins / 60)} giờ ${mins % 60} phút`
          : `${Math.max(1, mins)} phút`;
      }
    }
  }
  if (!duration) {
    duration = "1 phút";
  }

  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    region: row.region,
    difficulty: row.difficulty,
    distanceKm: Number(row.distance_km),
    elevationGainM: Number(row.elevation_gain_m),
    duration,
    terrainType: row.terrain_type,
    description: row.description || "",
    visibility: row.visibility,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason || undefined,
    gpsSegments,
    gpsRoute,
    checkpoints,
    clientRecordingId: row.client_recording_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const recordingDatabase = {
  /**
   * Tạo phiên ghi mới trong SQLite
   */
  async createRecording(
    clientRecordingId: string = generateUUID(),
    startedAt: string = new Date().toISOString(),
  ): Promise<LocalRecording> {
    const auth = await readStoredAuth();
    if (!auth?.user.id) throw new Error("Vui lòng đăng nhập trước khi ghi cung đường.");
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO local_recordings (
        client_recording_id, status, started_at, next_segment_id, owner_id
      ) VALUES (?, ?, ?, ?, ?)`,
      [clientRecordingId, "RECORDING", startedAt, 0, auth.user.id],
    );

    return {
      ownerId: auth.user.id,
      clientRecordingId,
      serverRecordingId: null,
      status: "RECORDING",
      startedAt,
      endedAt: null,
      nextSegmentId: 0,
      lastSyncedAt: null,
      serverPersonalTrailId: null,
      localTrailId: null,
      duration: null,
      elapsedSeconds: null,
    };
  },

  /**
   * Tìm phiên ghi đang chạy dở (Crash recovery)
   */
  async getActiveRecording(): Promise<LocalRecording | null> {
    const auth = await readStoredAuth();
    if (!auth?.user.id) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM local_recordings 
       WHERE owner_id = ? AND status IN ('RECORDING', 'PAUSED') 
       ORDER BY started_at DESC LIMIT 1`,
      [auth.user.id],
    );

    if (!row) return null;

    return {
      ownerId: row.owner_id,
      clientRecordingId: row.client_recording_id,
      serverRecordingId: row.server_recording_id,
      status: row.status as RecordingStatus,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      nextSegmentId: row.next_segment_id,
      lastSyncedAt: row.last_synced_at,
      serverPersonalTrailId: row.server_personal_trail_id,
      localTrailId: row.local_trail_id || null,
      duration: row.duration || null,
      elapsedSeconds: row.elapsed_seconds || null,
    };
  },

  /**
   * Lấy thông tin một phiên ghi theo ID (hỗ trợ tìm qua clientRecordingId, localTrailId hoặc serverPersonalTrailId)
   */
  async getRecording(
    identifier: string,
  ): Promise<LocalRecording | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM local_recordings 
       WHERE client_recording_id = ? 
          OR local_trail_id = ? 
          OR server_personal_trail_id = ?`,
      [identifier, identifier, identifier],
    );

    if (!row) return null;

    return {
      ownerId: row.owner_id,
      clientRecordingId: row.client_recording_id,
      serverRecordingId: row.server_recording_id,
      status: row.status as RecordingStatus,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      nextSegmentId: row.next_segment_id,
      lastSyncedAt: row.last_synced_at,
      serverPersonalTrailId: row.server_personal_trail_id,
      localTrailId: row.local_trail_id || null,
      duration: row.duration || null,
      elapsedSeconds: row.elapsed_seconds || null,
    };
  },

  /**
   * Cập nhật trạng thái phiên ghi
   */
  async updateRecordingStatus(
    clientRecordingId: string,
    status: RecordingStatus,
    options?: {
      endedAt?: string | null;
      serverRecordingId?: string | null;
      serverPersonalTrailId?: string | null;
      localTrailId?: string | null;
      lastSyncedAt?: string | null;
      duration?: string | null;
      elapsedSeconds?: number | null;
    },
  ): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = ["status = ?"];
    const params: any[] = [status];

    if (options?.endedAt !== undefined) {
      fields.push("ended_at = ?");
      params.push(options.endedAt);
    }
    if (options?.serverRecordingId !== undefined) {
      fields.push("server_recording_id = ?");
      params.push(options.serverRecordingId);
    }
    if (options?.serverPersonalTrailId !== undefined) {
      fields.push("server_personal_trail_id = ?");
      params.push(options.serverPersonalTrailId);
    }
    if (options?.localTrailId !== undefined) {
      fields.push("local_trail_id = ?");
      params.push(options.localTrailId);
    }
    if (options?.lastSyncedAt !== undefined) {
      fields.push("last_synced_at = ?");
      params.push(options.lastSyncedAt);
    }
    if (options?.duration !== undefined) {
      fields.push("duration = ?");
      params.push(options.duration);
    }
    if (options?.elapsedSeconds !== undefined) {
      fields.push("elapsed_seconds = ?");
      params.push(options.elapsedSeconds);
    }

    params.push(clientRecordingId);

    await db.runAsync(
      `UPDATE local_recordings SET ${fields.join(", ")} WHERE client_recording_id = ?`,
      params,
    );
  },

  /**
   * Tăng segment ID khi Pause/Resume hoặc khoảng trống GPS > 15s
   */
  async incrementSegmentId(clientRecordingId: string): Promise<number> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE local_recordings SET next_segment_id = next_segment_id + 1 WHERE client_recording_id = ?`,
      [clientRecordingId],
    );

    const row = await db.getFirstAsync<{ next_segment_id: number }>(
      `SELECT next_segment_id FROM local_recordings WHERE client_recording_id = ?`,
      [clientRecordingId],
    );

    return row?.next_segment_id ?? 0;
  },

  /**
   * Chèn mẫu GPS gốc (Raw GPS Sample) vào SQLite TRƯỚC khi cập nhật UI
   */
  async insertRawSample(sample: RawGpsSample): Promise<void> {
    return queuePersonalTrailWrite(async () => {
    if (!personalTrailWriteAllowed(sample.clientRecordingId)) return;
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR IGNORE INTO raw_gps_samples (
        client_sample_id, client_recording_id, latitude, longitude,
        recorded_at, accuracy_m, altitude_m, altitude_accuracy_m,
        speed_mps, heading_deg, segment_id, accepted, reject_reason, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sample.clientSampleId,
        sample.clientRecordingId,
        sample.latitude,
        sample.longitude,
        sample.recordedAt,
        sample.accuracyM,
        sample.altitudeM,
        sample.altitudeAccuracyM,
        sample.speedMps,
        sample.headingDeg,
        sample.segmentId,
        sample.accepted ? 1 : 0,
        sample.rejectReason || null,
        0,
      ],
    );
    }, true);
  },

  /**
   * Lấy tất cả mẫu GPS thô của một phiên ghi
   */
  async getRawSamples(clientRecordingId: string): Promise<RawGpsSample[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM raw_gps_samples 
       WHERE client_recording_id = ? 
       ORDER BY recorded_at ASC, client_sample_id ASC`,
      [clientRecordingId],
    );

    return rows.map((r) => ({
      clientSampleId: r.client_sample_id,
      clientRecordingId: r.client_recording_id,
      latitude: r.latitude,
      longitude: r.longitude,
      recordedAt: r.recorded_at,
      accuracyM: r.accuracy_m,
      altitudeM: r.altitude_m,
      altitudeAccuracyM: r.altitude_accuracy_m,
      speedMps: r.speed_mps,
      headingDeg: r.heading_deg,
      segmentId: r.segment_id,
      accepted: r.accepted === 1,
      rejectReason: r.reject_reason,
    }));
  },

  /**
   * Lấy các điểm GPS đã được chấp nhận (accepted = 1) để khôi phục hoặc vẽ lên MapLibre
   */
  async getAcceptedPoints(clientRecordingId: string): Promise<RawGpsSample[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM raw_gps_samples 
       WHERE client_recording_id = ? AND accepted = 1 
       ORDER BY recorded_at ASC, client_sample_id ASC`,
      [clientRecordingId],
    );

    return rows.map((r) => ({
      clientSampleId: r.client_sample_id,
      clientRecordingId: r.client_recording_id,
      latitude: r.latitude,
      longitude: r.longitude,
      recordedAt: r.recorded_at,
      accuracyM: r.accuracy_m,
      altitudeM: r.altitude_m,
      altitudeAccuracyM: r.altitude_accuracy_m,
      speedMps: r.speed_mps,
      headingDeg: r.heading_deg,
      segmentId: r.segment_id,
      accepted: true,
      rejectReason: null,
    }));
  },

  /**
   * Thêm Checkpoint vào phiên ghi
   */
  async insertCheckpoint(cp: LocalCheckpoint): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_checkpoints (
        client_checkpoint_id, client_recording_id, name, order_index,
        latitude, longitude, recorded_at, distance_from_start_km, elevation_live_m
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cp.clientCheckpointId,
        cp.clientRecordingId,
        cp.name,
        cp.order,
        cp.latitude,
        cp.longitude,
        cp.recordedAt,
        cp.distanceFromStartKm,
        cp.elevationLiveM,
      ],
    );
  },

  /**
   * Lấy danh sách Checkpoints của một phiên ghi
   */
  async getCheckpoints(clientRecordingId: string): Promise<LocalCheckpoint[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM local_checkpoints 
       WHERE client_recording_id = ? 
       ORDER BY order_index ASC`,
      [clientRecordingId],
    );

    return rows.map((r) => ({
      clientCheckpointId: r.client_checkpoint_id,
      clientRecordingId: r.client_recording_id,
      name: r.name,
      order: r.order_index,
      latitude: r.latitude,
      longitude: r.longitude,
      recordedAt: r.recorded_at,
      distanceFromStartKm: r.distance_from_start_km,
      elevationLiveM: r.elevation_live_m,
    }));
  },

  /**
   * Đưa tác vụ vào Outbox để đồng bộ ngầm lên Backend
   */
  async enqueueOutbox(
    clientRecordingId: string,
    operation: SyncOutboxItem["operation"],
    payload: any,
  ): Promise<SyncOutboxItem> {
    const db = await getDatabase();
    const id = generateUUID();
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(payload);

    await db.runAsync(
      `INSERT INTO sync_outbox (
        id, client_recording_id, operation, payload_json, state, attempt_count, created_at
      ) VALUES (?, ?, ?, ?, 'PENDING', 0, ?)`,
      [id, clientRecordingId, operation, payloadJson, now],
    );

    return {
      id,
      clientRecordingId,
      operation,
      payloadJson,
      state: "PENDING",
      attemptCount: 0,
      nextRetryAt: null,
      createdAt: now,
    };
  },

  /**
   * Lấy các tác vụ Outbox đang chờ gửi
   */
  async getPendingOutbox(ownerId: string): Promise<SyncOutboxItem[]> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // Tự động phục hồi các tác vụ bị kẹt ở trạng thái SYNCING (do crash/đóng app đột ngột)
    await db.runAsync(
      `UPDATE sync_outbox SET state = 'PENDING' WHERE state = 'SYNCING'
       AND client_recording_id IN (SELECT client_recording_id FROM local_recordings WHERE owner_id = ?)`,
      [ownerId],
    );

    // Chỉ lấy:
    // 1. Tác vụ PENDING mới hoặc đã đến giờ chạy (next_retry_at IS NULL hoặc <= now)
    // 2. Tác vụ FAILED tạm thời còn hạn thử lại (attempt_count < 10, next_retry_at IS NOT NULL và <= now)
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM sync_outbox AS current
       WHERE client_recording_id IN (SELECT client_recording_id FROM local_recordings WHERE owner_id = ?)
       AND ((state = 'PENDING' AND (next_retry_at IS NULL OR next_retry_at <= ?))
          OR (state = 'FAILED' AND attempt_count < 10 AND next_retry_at IS NOT NULL AND next_retry_at <= ?))
       AND NOT EXISTS (
         SELECT 1 FROM sync_outbox AS earlier
         WHERE earlier.client_recording_id = current.client_recording_id
           AND earlier.state != 'SYNCED'
           AND (earlier.created_at < current.created_at
             OR (earlier.created_at = current.created_at AND earlier.rowid < current.rowid))
       )
       ORDER BY created_at ASC, rowid ASC LIMIT 10`,
      [ownerId, now, now],
    );

    return rows.map((r) => ({
      id: r.id,
      clientRecordingId: r.client_recording_id,
      operation: r.operation,
      payloadJson: r.payload_json,
      state: r.state,
      attemptCount: r.attempt_count,
      nextRetryAt: r.next_retry_at,
      createdAt: r.created_at,
    }));
  },

  /**
   * Reset các mục FAILED về PENDING để người dùng chủ động gửi lại.
   * Không chạm vào SYNCING vì có thể đang được tiến trình tự động xử lý.
   */
  async resetAllPendingOutbox(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_outbox 
       SET state = 'PENDING', next_retry_at = NULL, attempt_count = 0 
       WHERE state = 'FAILED'`,
    );
  },

  /**
   * Lấy toàn bộ danh sách tác vụ trong outbox (để kiểm tra chẩn đoán)
   */
  async getAllOutboxItems(): Promise<SyncOutboxItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM sync_outbox ORDER BY created_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      clientRecordingId: r.client_recording_id,
      operation: r.operation,
      payloadJson: r.payload_json,
      state: r.state,
      attemptCount: r.attempt_count,
      nextRetryAt: r.next_retry_at,
      createdAt: r.created_at,
    }));
  },

  /**
   * Cập nhật trạng thái mục Outbox
   */
  async updateOutboxItem(
    id: string,
    state: SyncOutboxItem["state"],
    options?: { attemptCount?: number; nextRetryAt?: string | null },
  ): Promise<void> {
    const db = await getDatabase();
    const fields = ["state = ?"];
    const params: any[] = [state];

    if (options?.attemptCount !== undefined) {
      fields.push("attempt_count = ?");
      params.push(options.attemptCount);
    }
    if (options?.nextRetryAt !== undefined) {
      fields.push("next_retry_at = ?");
      params.push(options.nextRetryAt);
    }
    params.push(id);

    await db.runAsync(
      `UPDATE sync_outbox SET ${fields.join(", ")} WHERE id = ?`,
      params,
    );
  },

  /**
   * Xóa một tác vụ khỏi Outbox
   */
  async deleteOutboxItem(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM sync_outbox WHERE id = ?`, [id]);
  },

  /**
   * Xóa toàn bộ dữ liệu của một phiên ghi (outbox, samples, checkpoints, recording)
   */
  async deleteRecording(clientRecordingId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM sync_outbox WHERE client_recording_id = ?`,
      [clientRecordingId],
    );
    await db.runAsync(
      `DELETE FROM raw_gps_samples WHERE client_recording_id = ?`,
      [clientRecordingId],
    );
    await db.runAsync(
      `DELETE FROM local_checkpoints WHERE client_recording_id = ?`,
      [clientRecordingId],
    );
    await db.runAsync(
      `DELETE FROM personal_trails WHERE client_recording_id = ?`,
      [clientRecordingId],
    );
    await db.runAsync(
      `DELETE FROM local_recordings WHERE client_recording_id = ?`,
      [clientRecordingId],
    );
  },

  /**
   * Đánh dấu các điểm sample đã được Backend xác nhận (ACK)
   */
  async markSamplesSynced(
    clientRecordingId: string,
    clientSampleIds: string[],
  ): Promise<void> {
    if (clientSampleIds.length === 0) return;
    const db = await getDatabase();
    const placeholders = clientSampleIds.map(() => "?").join(",");
    await db.runAsync(
      `UPDATE raw_gps_samples SET synced = 1 
       WHERE client_recording_id = ? AND client_sample_id IN (${placeholders})`,
      [clientRecordingId, ...clientSampleIds],
    );
  },

  /**
   * Lấy các điểm GPS chưa đồng bộ để tạo batch gửi lên server
   */
  async getUnsyncedSamples(
    clientRecordingId: string,
    limit: number = 200,
  ): Promise<RawGpsSample[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM raw_gps_samples 
       WHERE client_recording_id = ? AND synced = 0
       ORDER BY recorded_at ASC, client_sample_id ASC 
       LIMIT ?`,
      [clientRecordingId, limit],
    );

    return rows.map((r) => ({
      clientSampleId: r.client_sample_id,
      clientRecordingId: r.client_recording_id,
      latitude: r.latitude,
      longitude: r.longitude,
      recordedAt: r.recorded_at,
      accuracyM: r.accuracy_m,
      altitudeM: r.altitude_m,
      altitudeAccuracyM: r.altitude_accuracy_m,
      speedMps: r.speed_mps,
      headingDeg: r.heading_deg,
      segmentId: r.segment_id,
      accepted: r.accepted === 1,
      rejectReason: r.reject_reason,
    }));
  },

  /**
   * Lấy danh sách tất cả các phiên ghi cục bộ
   */
  async getAllRecordings(): Promise<LocalRecording[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM local_recordings ORDER BY started_at DESC`,
    );

    return rows.map((r) => ({
      clientRecordingId: r.client_recording_id,
      serverRecordingId: r.server_recording_id,
      status: r.status as RecordingStatus,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      nextSegmentId: r.next_segment_id,
      lastSyncedAt: r.last_synced_at,
      serverPersonalTrailId: r.server_personal_trail_id,
      duration: r.duration || null,
      elapsedSeconds: r.elapsed_seconds || null,
    }));
  },



  /**
   * Lưu hoặc cập nhật một PersonalTrail vào bảng SQLite personal_trails
   */
  async attachServerRecordingId(id: string, serverId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE local_recordings SET server_recording_id = ? WHERE client_recording_id = ?', [serverId, id]);
  },

  async finishPersonalTrail(trail: PersonalTrail, endedAt: string, elapsedSeconds: number): Promise<void> {
    await queuePersonalTrailWrite(async () => {
      const db = await getDatabase();
      await db.withExclusiveTransactionAsync(async tx => {
        const id = trail.clientRecordingId!;
        const existing = await tx.getFirstAsync<{ id: string }>(
          "SELECT id FROM sync_outbox WHERE client_recording_id = ? AND operation = 'FINISH_RECORDING'", [id]);
        if (existing) return;
        await this.savePersonalTrail(trail, id, tx as SQLite.SQLiteDatabase);
        await tx.runAsync("UPDATE local_recordings SET status='STOPPED_LOCAL', local_trail_id=?, ended_at=?, duration=?, elapsed_seconds=? WHERE client_recording_id=?",
          [trail.id, endedAt, trail.duration, elapsedSeconds, id]);
        const payload = { endedAt, title: trail.name, description: trail.description, region: trail.region,
          difficulty: trail.difficulty, terrainType: trail.terrainType, visibility: trail.visibility,
          distanceKm: trail.distanceKm, elevationGainM: trail.elevationGainM, duration: trail.duration, elapsedSeconds, checkpoints: [] };
        for (const operation of ['BATCH_POINTS', 'FINISH_RECORDING']) {
          await tx.runAsync("INSERT INTO sync_outbox(id,client_recording_id,operation,payload_json,state,attempt_count,created_at) VALUES(?,?,?,?,'PENDING',0,?)",
            [generateUUID(), id, operation, JSON.stringify(operation === 'BATCH_POINTS' ? {} : payload), endedAt]);
        }
      });
    });
  },

  async savePersonalTrail(
    trail: PersonalTrail,
    clientRecordingId?: string,
    transaction?: SQLite.SQLiteDatabase,
  ): Promise<void> {
    const db = transaction ?? await getDatabase();
    const effectiveRecordingId =
      clientRecordingId || trail.clientRecordingId || null;

    // Đảm bảo phiên ghi trong local_recordings tồn tại nếu có recording ID
    if (effectiveRecordingId) {
      const existing = await db.getFirstAsync<any>(
        `SELECT client_recording_id FROM local_recordings WHERE client_recording_id = ?`,
        [effectiveRecordingId],
      );

      if (!existing) {
        await db.runAsync(
          `INSERT OR IGNORE INTO local_recordings (
            client_recording_id, status, started_at, ended_at, next_segment_id, server_personal_trail_id, owner_id
          ) VALUES (?, 'STOPPED_LOCAL', ?, ?, ?, ?, ?)`,
          [
            effectiveRecordingId,
            trail.createdAt || new Date().toISOString(),
            trail.updatedAt || new Date().toISOString(),
            trail.gpsSegments?.length || 1,
            trail.id,
            trail.ownerId,
          ],
        );
      } else {
        await db.runAsync(
          `UPDATE local_recordings 
           SET server_personal_trail_id = ? 
           WHERE client_recording_id = ?`,
          [trail.id, effectiveRecordingId],
        );
      }
    }

    const effectiveSegments: [number, number, number?][][] =
      trail.gpsSegments && trail.gpsSegments.length > 0
        ? trail.gpsSegments
        : trail.gpsRoute && trail.gpsRoute.length > 0
          ? [trail.gpsRoute]
          : [];

    await db.runAsync(
      `INSERT OR REPLACE INTO personal_trails (
        id, owner_id, name, region, difficulty,
        distance_km, elevation_gain_m, duration, terrain_type, description,
        visibility, verification_status, rejection_reason,
        gps_segments_json, checkpoints_json,
        client_recording_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trail.id,
        trail.ownerId,
        trail.name,
        trail.region,
        trail.difficulty,
        trail.distanceKm,
        trail.elevationGainM,
        trail.duration || "1 phút",
        trail.terrainType,
        trail.description || "",
        trail.visibility,
        trail.verificationStatus,
        trail.rejectionReason || null,
        JSON.stringify(effectiveSegments),
        JSON.stringify(trail.checkpoints || []),
        effectiveRecordingId,
        trail.createdAt,
        trail.updatedAt,
      ],
    );
  },

  /**
   * Lưu toàn bộ danh sách PersonalTrail vào SQLite
   */
  async saveAllPersonalTrails(trails: PersonalTrail[]): Promise<void> {
    for (const trail of trails) {
      await this.savePersonalTrail(trail);
    }
  },

  /**
   * Lấy toàn bộ danh sách PersonalTrail từ SQLite
   */
  async getAllPersonalTrails(): Promise<PersonalTrail[]> {
    const auth = await readStoredAuth();
    if (!auth?.user.id) return [];
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM personal_trails WHERE owner_id = ? ORDER BY created_at DESC`,
      [auth.user.id],
    );
    return rows.map(rowToPersonalTrail);
  },

  /**
   * Lấy một PersonalTrail theo ID từ SQLite
   */
  async getPersonalTrailById(id: string): Promise<PersonalTrail | null> {
    const auth = await readStoredAuth();
    if (!auth?.user.id) return null;
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM personal_trails WHERE id = ? AND owner_id = ?`,
      [id, auth.user.id],
    );
    return row ? rowToPersonalTrail(row) : null;
  },

  /**
   * Lấy một PersonalTrail theo client_recording_id từ SQLite
   */
  async getPersonalTrailByRecordingId(
    clientRecordingId: string,
  ): Promise<PersonalTrail | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      `SELECT * FROM personal_trails WHERE client_recording_id = ?`,
      [clientRecordingId],
    );
    return row ? rowToPersonalTrail(row) : null;
  },

  /**
   * Xóa một PersonalTrail chỉ khỏi bảng personal_trails
   */
  async removePersonalTrailOnly(trailId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM personal_trails WHERE id = ?`, [trailId]);
  },

  /** Only remove a local trail after its exact server identity was fetched and cached. */
  async getSyncedLocalTrailIds(
    serverTrailIds: string[],
    serverClientRecordingIds: string[] = [],
  ): Promise<string[]> {
    const auth = await readStoredAuth();
    if (!auth?.user.id) return [];
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      client_recording_id: string | null;
      server_personal_trail_id: string | null;
    }>(
      `SELECT pt.id, pt.client_recording_id, lr.server_personal_trail_id
       FROM personal_trails pt LEFT JOIN local_recordings lr
         ON pt.client_recording_id = lr.client_recording_id
       WHERE pt.owner_id = ? AND NOT EXISTS (
         SELECT 1 FROM raw_gps_samples gps
         WHERE gps.client_recording_id = pt.client_recording_id AND gps.synced = 0
       )`,
      [auth.user.id],
    );
    return rows.filter((row) =>
      serverTrailIds.includes(row.id) ||
      (row.client_recording_id != null && serverClientRecordingIds.includes(row.client_recording_id)) ||
      (row.server_personal_trail_id != null && serverTrailIds.includes(row.server_personal_trail_id))
    ).map((row) => row.id);
  },

  /** A separate cache keeps server routes available offline without recording foreign keys. */
  async cacheServerPersonalTrails(ownerId: string, trails: PersonalTrail[]): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO personal_trail_cache (owner_id, trails_json) VALUES (?, ?)",
      [ownerId, JSON.stringify(trails)],
    );
  },

  async updateCachedServerPersonalTrail(ownerId: string, trail: PersonalTrail): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO personal_trail_cache (owner_id, trails_json) VALUES (?, json_array(json(?)))
       ON CONFLICT(owner_id) DO UPDATE SET trails_json = json_insert(
         (SELECT json_group_array(json(value)) FROM json_each(personal_trail_cache.trails_json)
          WHERE json_extract(value, '$.id') != ?), '$[#]', json(?))`,
      [ownerId, JSON.stringify(trail), trail.id, JSON.stringify(trail)],
    );
  },

  async removeCachedServerPersonalTrail(ownerId: string, trailId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE personal_trail_cache SET trails_json =
         (SELECT json_group_array(json(value)) FROM json_each(trails_json)
          WHERE json_extract(value, '$.id') != ?)
       WHERE owner_id = ?`,
      [trailId, ownerId],
    );
  },

  async getCachedServerPersonalTrails(ownerId: string): Promise<PersonalTrail[]> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ trails_json: string }>(
      "SELECT trails_json FROM personal_trail_cache WHERE owner_id = ?", [ownerId],
    );
    return row ? JSON.parse(row.trails_json) as PersonalTrail[] : [];
  },

  /**
   * Xóa những PersonalTrail đã có trên server khỏi bảng SQLite personal_trails
   * để không lưu thừa thãi trên điện thoại
   */
  async removeSyncedPersonalTrails(serverTrailIds: string[]): Promise<void> {
    if (serverTrailIds.length === 0) return;
    const db = await getDatabase();
    const placeholders = serverTrailIds.map(() => "?").join(",");
    await db.withTransactionAsync(async () => {
      const linkedRecordings = await db.getAllAsync<{
        client_recording_id: string;
      }>(
        `SELECT DISTINCT lr.client_recording_id
         FROM local_recordings lr
         LEFT JOIN personal_trails pt
           ON pt.client_recording_id = lr.client_recording_id
         WHERE pt.id IN (${placeholders})
           AND (
             lr.status = 'READY'
             OR lr.server_personal_trail_id IN (${placeholders})
             OR EXISTS (
               SELECT 1 FROM sync_outbox so
               WHERE so.client_recording_id = lr.client_recording_id
                 AND so.operation IN ('FINISH_RECORDING', 'CREATE_TRAIL')
                 AND so.state = 'SYNCED'
             )
           )`,
        [...serverTrailIds, ...serverTrailIds],
      );

      await db.runAsync(
        `DELETE FROM personal_trails WHERE id IN (${placeholders})`,
        serverTrailIds,
      );

      for (const recording of linkedRecordings) {
        await db.runAsync(
          `DELETE FROM local_recordings WHERE client_recording_id = ?`,
          [recording.client_recording_id],
        );
      }
    });
  },

  /**
   * Dọn toàn bộ dữ liệu local sau khi backend đã ACK finish và outbox đã SYNCED.
   * Xóa local_recordings sẽ cascade sang raw samples, checkpoints, outbox và trail.
   */
  async cleanupSyncedRecording(clientRecordingId: string): Promise<boolean> {
    const db = await getDatabase();
    let cleaned = false;

    await db.withTransactionAsync(async () => {
      const eligible = await db.getFirstAsync<{ client_recording_id: string }>(
        `SELECT lr.client_recording_id
         FROM local_recordings lr
         WHERE lr.client_recording_id = ?
           AND lr.status = 'READY'
           AND NOT EXISTS (
             SELECT 1 FROM raw_gps_samples gps
             WHERE gps.client_recording_id = lr.client_recording_id
               AND gps.synced = 0
           )
           AND EXISTS (
             SELECT 1 FROM sync_outbox so
             WHERE so.client_recording_id = lr.client_recording_id
               AND so.operation IN ('FINISH_RECORDING', 'CREATE_TRAIL')
               AND so.state = 'SYNCED'
           )`,
        [clientRecordingId],
      );

      if (!eligible) return;

      await db.runAsync(
        `DELETE FROM local_recordings WHERE client_recording_id = ?`,
        [clientRecordingId],
      );
      cleaned = true;
    });

    return cleaned;
  },

  /**
   * Xóa một PersonalTrail và phiên ghi SQLite liên quan (kèm cascade xóa samples, checkpoints, outbox)
   */
  async deletePersonalTrail(trailId: string): Promise<void> {
    const db = await getDatabase();

    // 1. Tìm thông tin trail để lấy client_recording_id nếu có
    const trail = await db.getFirstAsync<any>(
      `SELECT client_recording_id FROM personal_trails WHERE id = ?`,
      [trailId],
    );

    const recordingId = trail?.client_recording_id;

    // 2. Xóa khỏi personal_trails
    await db.runAsync(`DELETE FROM personal_trails WHERE id = ?`, [trailId]);

    // 3. Xóa các phiên ghi local_recordings liên kết
    // (Bằng server_personal_trail_id HOẶC client_recording_id)
    if (recordingId) {
      await db.runAsync(
        `DELETE FROM local_recordings WHERE client_recording_id = ? OR server_personal_trail_id = ?`,
        [recordingId, trailId],
      );
    } else {
      await db.runAsync(
        `DELETE FROM local_recordings WHERE server_personal_trail_id = ?`,
        [trailId],
      );
    }
  },

  /**
   * Alias: Xóa phiên ghi theo trailId
   */
  async deleteRecordingByTrailId(trailId: string): Promise<void> {
    return this.deletePersonalTrail(trailId);
  },

  /**
   * Đồng bộ dữ liệu cũ từ AsyncStorage sang SQLite (Chỉ chạy 1 lần an toàn)
   */
  async migrateFromAsyncStorage(): Promise<void> {
    try {
      const db = await getDatabase();
      const existing = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM personal_trails`,
      );

      if (existing && existing.count > 0) {
        return;
      }

      const legacyRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.PERSONAL_TRAILS,
      );
      if (legacyRaw) {
        const legacyTrails: PersonalTrail[] = JSON.parse(legacyRaw);
        if (legacyTrails && legacyTrails.length > 0) {
          for (const trail of legacyTrails) {
            await this.savePersonalTrail(trail);
          }
          console.log(
            `[recordingDatabase] Đã di chuyển an toàn ${legacyTrails.length} cung đường từ AsyncStorage sang SQLite`,
          );
        }
        await AsyncStorage.removeItem(STORAGE_KEYS.PERSONAL_TRAILS);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.MIGRATION_SQLITE, "true");
    } catch (err) {
      console.warn(
        "[recordingDatabase] Migration from AsyncStorage failed:",
        err,
      );
    }
  },

  /**
   * Xóa sạch toàn bộ dữ liệu trong tất cả các bảng SQLite
   */
  async clearAllData(): Promise<void> {
    const db = await getDatabase();
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM personal_trail_cache;
      DELETE FROM personal_trails;
      DELETE FROM raw_gps_samples;
      DELETE FROM local_checkpoints;
      DELETE FROM sync_outbox;
      DELETE FROM local_recordings;
      PRAGMA foreign_keys = ON;
      VACUUM;
    `);
    console.log("[recordingDatabase] Đã xóa sạch toàn bộ dữ liệu trong tất cả các bảng SQLite!");
  },
};
