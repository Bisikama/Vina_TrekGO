import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, generateUUID } from '@/services/storage/recordingDatabase';
import type { GpsSample, SessionDto, GpsPolicyDto } from '../types';

const DEVICE_ID_KEY = '@trekgo_gps_device_id';

/**
 * 1. Định danh thiết bị ổn định (deviceId)
 */
export async function getOrCreateDeviceId(requirePersistent = false): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length > 5) {
      return existing;
    }
    const newId = `dev-${generateUUID()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch {
    if (requirePersistent) throw new Error('Không lưu được định danh thiết bị GPS. Vui lòng kiểm tra bộ nhớ trước khi tạo phiên.');
    return `dev-${Date.now()}`;
  }
}

/**
 * 2. Khởi tạo bảng SQLite cho Trip GPS
 */
export async function initTripGpsTables(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS trip_gps_sessions (
      session_id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      client_session_id TEXT NOT NULL UNIQUE,
      device_id TEXT NOT NULL,
      status TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      policy_json TEXT NOT NULL,
      intervals_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trip_gps_samples (
      client_sample_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy_m REAL NOT NULL,
      altitude_m REAL,
      speed_mps REAL,
      heading_deg REAL,
      recorded_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0, -- 0: PENDING, 1: ACCEPTED, 2: REJECTED
      reject_code TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES trip_gps_sessions(session_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trip_gps_samples_sync
      ON trip_gps_samples(session_id, synced, recorded_at);

    CREATE TABLE IF NOT EXISTS trip_gps_commands (
      command_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      action TEXT NOT NULL,             -- 'PAUSE' | 'RESUME' | 'FINISH'
      expected_version INTEGER NOT NULL,
      occurred_at TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'SYNCED' | 'FAILED'
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES trip_gps_sessions(session_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trip_gps_commands_status
      ON trip_gps_commands(session_id, status, occurred_at);
  `);

  try {
    await db.execAsync(`ALTER TABLE trip_gps_sessions ADD COLUMN intervals_json TEXT;`);
  } catch {
    // Column already exists, safe to ignore
  }
}

/**
 * 3. Quản lý Phiên (Session)
 */
export async function saveLocalTripSession(session: SessionDto, policy: GpsPolicyDto): Promise<void> {
  await initTripGpsTables();
  const db = await getDatabase();
  const now = new Date().toISOString();
  const intervalsJson = session.recordingIntervals ? JSON.stringify(session.recordingIntervals) : null;
  await db.runAsync(
    `INSERT INTO trip_gps_sessions (
      session_id, trip_id, client_session_id, device_id, status, version, started_at, ended_at, policy_json, intervals_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      status = excluded.status, version = excluded.version,
      ended_at = excluded.ended_at, policy_json = excluded.policy_json,
      intervals_json = coalesce(excluded.intervals_json, trip_gps_sessions.intervals_json)`,
    [
      session.id,
      session.tripId,
      session.clientSessionId,
      session.deviceId,
      session.status,
      session.version,
      session.startedAt,
      session.endedAt,
      JSON.stringify(policy),
      intervalsJson,
      now,
    ]
  );
}

export async function getActiveTripSession(tripId: string): Promise<{ session: SessionDto; policy: GpsPolicyDto } | null> {
  await initTripGpsTables();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    session_id: string;
    trip_id: string;
    client_session_id: string;
    device_id: string;
    status: string;
    version: number;
    started_at: string;
    ended_at: string | null;
    policy_json: string;
    intervals_json?: string | null;
  }>(
    `SELECT * FROM trip_gps_sessions WHERE trip_id = ? ORDER BY started_at DESC LIMIT 1`,
    [tripId]
  );

  if (!row) return null;

  try {
    const policy: GpsPolicyDto = JSON.parse(row.policy_json);
    let recordingIntervals: { start: string; end: string | null }[] | undefined;
    if (row.intervals_json) {
      try {
        recordingIntervals = JSON.parse(row.intervals_json);
      } catch {}
    }
    const session: SessionDto = {
      id: row.session_id,
      tripId: row.trip_id,
      userId: '', // Populated by hook from AuthContext
      clientSessionId: row.client_session_id,
      deviceId: row.device_id,
      gpsPolicyId: policy.id,
      status: row.status as SessionDto['status'],
      version: row.version,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      uploadDeadline: null,
      sampleCount: 0,
      totalDistanceMeters: null,
      recordingIntervals,
    };
    return { session, policy };
  } catch {
    return null;
  }
}

/** Include stopped sessions so starting another session never strands their outbox. */
export async function getTripSessionsWithPendingSamples(tripId: string): Promise<string[]> {
  await initTripGpsTables();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ session_id: string }>(
    `SELECT DISTINCT s.session_id FROM trip_gps_sessions s
     JOIN trip_gps_samples p ON p.session_id = s.session_id
     WHERE s.trip_id = ? AND p.synced = 0`, [tripId]);
  return rows.map(row => row.session_id);
}

export async function updateLocalSessionStatus(
  sessionId: string,
  status: SessionDto['status'],
  version: number,
  endedAt?: string | null,
  intervals?: { start: string; end: string | null }[]
): Promise<void> {
  const db = await getDatabase();
  const intervalsJson = intervals ? JSON.stringify(intervals) : null;
  await db.runAsync(
    `UPDATE trip_gps_sessions SET
      status = ?,
      version = ?,
      ended_at = coalesce(?, ended_at),
      intervals_json = coalesce(?, intervals_json)
     WHERE session_id = ?`,
    [status, version, endedAt || null, intervalsJson, sessionId]
  );
}

/**
 * 4. Quản lý Điểm GPS (Samples)
 */
export async function insertGpsSample(sessionId: string, sample: GpsSample): Promise<void> {
  await initTripGpsTables();
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR IGNORE INTO trip_gps_samples (
      client_sample_id, session_id, latitude, longitude, accuracy_m, altitude_m, speed_mps, heading_deg, recorded_at, synced, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      sample.clientSampleId,
      sessionId,
      sample.latitude,
      sample.longitude,
      sample.accuracyM,
      sample.altitudeM ?? null,
      sample.speedMps ?? null,
      sample.headingDeg ?? null,
      sample.recordedAt,
      now,
    ]
  );
}

/** Lấy danh sách điểm GPS chưa đồng bộ để tạo batch gửi lên server (mặc định tối đa 200 điểm theo policy) */
export async function getLatestSessionSampleTime(sessionId: string): Promise<string | null> {
  await initTripGpsTables();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ recorded_at: string | null }>(
    `SELECT MAX(recorded_at) AS recorded_at FROM trip_gps_samples WHERE session_id = ? AND synced != 2`,
    [sessionId]
  );
  return row?.recorded_at ?? null;
}

export async function getPendingSamples(sessionId: string, limit = 200): Promise<GpsSample[]> {
  await initTripGpsTables();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    client_sample_id: string;
    latitude: number;
    longitude: number;
    accuracy_m: number;
    altitude_m: number | null;
    speed_mps: number | null;
    heading_deg: number | null;
    recorded_at: string;
  }>(
    `SELECT client_sample_id, latitude, longitude, accuracy_m, altitude_m, speed_mps, heading_deg, recorded_at
     FROM trip_gps_samples
     WHERE session_id = ? AND synced = 0
     ORDER BY recorded_at ASC
     LIMIT ?`,
    [sessionId, limit]
  );

  return rows.map((r) => ({
    clientSampleId: r.client_sample_id,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracyM: r.accuracy_m,
    altitudeM: r.altitude_m,
    speedMps: r.speed_mps,
    headingDeg: r.heading_deg,
    recordedAt: r.recorded_at,
  }));
}

/** Đánh dấu các điểm đã được backend chấp nhận / trùng lặp (synced = 1) */
export async function markSamplesAccepted(sessionId: string, sampleIds: string[]): Promise<void> {
  if (sampleIds.length === 0) return;
  const db = await getDatabase();
  const placeholders = sampleIds.map(() => '?').join(',');
  await db.runAsync(
    `UPDATE trip_gps_samples SET synced = 1 WHERE session_id = ? AND client_sample_id IN (${placeholders})`,
    [sessionId, ...sampleIds]
  );
}

/** Đánh dấu các điểm bị server từ chối (synced = 2) cùng mã lỗi để không gửi lại vô hạn */
export async function markSamplesRejected(
  sessionId: string,
  rejected: { clientSampleId: string; code: string }[]
): Promise<void> {
  if (rejected.length === 0) return;
  const db = await getDatabase();
  for (const item of rejected) {
    await db.runAsync(
      `UPDATE trip_gps_samples SET synced = 2, reject_code = ? WHERE session_id = ? AND client_sample_id = ?`,
      [item.code, sessionId, item.clientSampleId]
    );
  }
}

/** Lấy toàn bộ toạ độ hợp lệ (đã ghi) của session để vẽ Live Route mượt mà */
export async function getSessionCoordinates(sessionId: string): Promise<[number, number][]> {
  await initTripGpsTables();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ longitude: number; latitude: number }>(
    `SELECT longitude, latitude FROM trip_gps_samples WHERE session_id = ? AND synced != 2 ORDER BY recorded_at ASC`,
    [sessionId]
  );
  return rows.map((r) => [r.longitude, r.latitude]);
}

/**
 * 5. Quản lý Hàng đợi Lệnh (Command Outbox)
 */
export async function enqueueSessionCommand(
  sessionId: string,
  commandId: string,
  action: 'PAUSE' | 'RESUME' | 'FINISH',
  expectedVersion: number,
  occurredAt: string,
  reason?: string
): Promise<void> {
  await initTripGpsTables();
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO trip_gps_commands (
      command_id, session_id, action, expected_version, occurred_at, reason, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
    [commandId, sessionId, action, expectedVersion, occurredAt, reason || null, now]
  );
}

export async function getPendingCommands(sessionId: string): Promise<{
  commandId: string;
  action: 'PAUSE' | 'RESUME' | 'FINISH';
  expectedVersion: number;
  occurredAt: string;
  reason?: string;
}[]> {
  await initTripGpsTables();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    command_id: string;
    action: 'PAUSE' | 'RESUME' | 'FINISH';
    expected_version: number;
    occurred_at: string;
    reason: string | null;
  }>(
    `SELECT command_id, action, expected_version, occurred_at, reason
     FROM trip_gps_commands
     WHERE session_id = ? AND status = 'PENDING'
     ORDER BY occurred_at ASC`,
    [sessionId]
  );

  return rows.map((r) => ({
    commandId: r.command_id,
    action: r.action,
    expectedVersion: r.expected_version,
    occurredAt: r.occurred_at,
    reason: r.reason || undefined,
  }));
}

export async function markCommandSynced(commandId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE trip_gps_commands SET status = 'SYNCED' WHERE command_id = ?`, [commandId]);
}

/**
 * 6. Quy tắc Dọn dẹp & Khi nào XÓA (Cleanup Policy)
 *
 * - GIỮ LẠI (Keep):
 *   + Khi phiên đang ACTIVE hoặc PAUSED (chưa kết thúc).
 *   + Khi còn điểm chưa đồng bộ (synced = 0) hoặc lệnh chưa hoàn tất.
 *   + Khi server đang trong quá trình dựng kết quả (PROCESSING).
 *
 * - XÓA ĐI (Delete):
 *   + Xóa các lệnh command đã SYNCED: giải phóng bảng command outbox.
 *   + Khi phiên đã STOPPED và toàn bộ điểm đã được server chấp nhận (synced = 1)
 *     và server đã trả về ActualRoute (READY hoặc EMPTY): gọi pruneCompletedSessionData để dọn các điểm thô.
 *   + Khi người dùng bị thu hồi quyền (access.revoked): gọi clearSessionData để xóa sạch cache đoàn/phiên.
 */
export async function pruneSyncedCommands(sessionId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM trip_gps_commands WHERE session_id = ? AND status = 'SYNCED'`, [sessionId]);
}

/** Dọn dẹp điểm thô sau khi chuyến đi đã kết thúc hoàn toàn và backend đã chốt ActualRoute */
export async function pruneCompletedSessionSamples(sessionId: string): Promise<void> {
  const db = await getDatabase();
  // Chỉ xóa các điểm đã đồng bộ xong (synced = 1) hoặc bị reject (synced = 2), không xóa điểm chưa kịp gửi
  await db.runAsync(`DELETE FROM trip_gps_samples WHERE session_id = ? AND synced IN (1, 2)`, [sessionId]);
}

/** Xóa toàn bộ dữ liệu session (khi hủy bỏ phiên hoặc bị thu hồi quyền truy cập) */
export async function clearSessionData(sessionId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM trip_gps_commands WHERE session_id = ?`, [sessionId]);
  await db.runAsync(`DELETE FROM trip_gps_samples WHERE session_id = ?`, [sessionId]);
  await db.runAsync(`DELETE FROM trip_gps_sessions WHERE session_id = ?`, [sessionId]);
}
