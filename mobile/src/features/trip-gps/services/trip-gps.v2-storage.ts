import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase, generateUUID } from '@/services/storage/recordingDatabase';
import type { GpsContextResponse, GpsStateResponse, SessionResponse, GpsSample, LocalSyncStatus, SyncCommand, SyncMetadata, SyncBatch, SyncManifest, SyncComplete } from '../types';
import { gpsHash } from './trip-gps.hash';

export interface SnapshotWork {
  batches: { payload: SyncBatch; ack?: { acceptedSampleIds: string[]; duplicateSampleIds: string[]; rejectedSamples: { clientSampleId: string; code: string }[] } }[];
  pages: { payload: SyncManifest; ack: boolean }[];
  complete: SyncComplete;
  submitted: boolean;
}
export interface LocalTrip extends SessionResponse {
  controlSyncMode: 'IMMEDIATE_LEGACY' | 'LOCAL_UNTIL_FINISH';
  accountId: string;
  protocolVersion: 2;
  localRevision: number;
  metadataRevision: number;
  sampleSequence: number;
  publishSequence: number;
  processedMaxSequence: number;
  processedRevision: number;
  syncStatus: LocalSyncStatus;
  lastError: string | null;
  nextRetryAt: string | null;
  metadata?: SyncMetadata;
  snapshot?: SnapshotWork;
  finalMaxSequence?: number;
  finalProcessed?: boolean;
  accessBlocked?: boolean;
  retryCount?: number;
  rejectedSamples?: { clientSampleId: string; code: string }[];
}
let initialized: Promise<void> | undefined;
let serial: Promise<unknown> = Promise.resolve();
function exclusive<T>(operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const result = serial.then(async () => {
    await initV2Storage();
    const db = await getDatabase();
    let value!: T;
    await db.withExclusiveTransactionAsync(async tx => { value = await operation(tx as SQLiteDatabase); });
    return value;
  });
  serial = result.catch(() => {});
  return result;
}
export function initV2Storage(): Promise<void> {
  if (!initialized) initialized = (async () => {
    const db = await getDatabase();
    await db.withExclusiveTransactionAsync(async tx => {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS trip_gps_mobile_migrations (version INTEGER PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS trip_gps_v2_sessions (
          account_id TEXT NOT NULL, session_id TEXT NOT NULL, trip_id TEXT NOT NULL, started_at TEXT NOT NULL,
          data_json TEXT NOT NULL, PRIMARY KEY(account_id, session_id));
        CREATE INDEX IF NOT EXISTS trip_gps_v2_trip ON trip_gps_v2_sessions(account_id, trip_id, started_at);
        CREATE TABLE IF NOT EXISTS trip_gps_v2_samples (
          account_id TEXT NOT NULL, session_id TEXT NOT NULL, sequence INTEGER NOT NULL,
          sample_id TEXT NOT NULL, payload_json TEXT NOT NULL,
          PRIMARY KEY(account_id, session_id, sample_id), UNIQUE(account_id, session_id, sequence));
        CREATE TABLE IF NOT EXISTS trip_gps_v2_commands (
          account_id TEXT NOT NULL, session_id TEXT NOT NULL, sequence INTEGER NOT NULL, payload_json TEXT NOT NULL,
          PRIMARY KEY(account_id, session_id, sequence));
        CREATE TABLE IF NOT EXISTS trip_gps_v2_snapshots (
          account_id TEXT NOT NULL, session_id TEXT NOT NULL, revision INTEGER NOT NULL, payload_json TEXT NOT NULL,
          PRIMARY KEY(account_id,session_id,revision));
        CREATE TABLE IF NOT EXISTS trip_gps_v2_cache (
          account_id TEXT NOT NULL, trip_id TEXT NOT NULL, context_json TEXT, state_json TEXT, start_id TEXT,
          PRIMARY KEY(account_id, trip_id));
        INSERT OR IGNORE INTO trip_gps_mobile_migrations(version) VALUES (2);
      `);
      const oldSessions = await tx.getAllAsync<{ account_id: string; session_id: string; data_json: string }>('SELECT account_id,session_id,data_json FROM trip_gps_v2_sessions');
      for (const row of oldSessions) {
        const trip = JSON.parse(row.data_json) as LocalTrip;
        // A request may have reached the server without its ACK reaching SQLite.
        // Keep all pre-mode sessions on their original control protocol.
        if (!trip.controlSyncMode) {
          trip.controlSyncMode = 'IMMEDIATE_LEGACY';
          await tx.runAsync('UPDATE trip_gps_v2_sessions SET data_json=? WHERE account_id=? AND session_id=?', JSON.stringify(trip), row.account_id, row.session_id);
        }
      }
      await tx.execAsync('INSERT OR IGNORE INTO trip_gps_mobile_migrations(version) VALUES (3);');
    });
  })().catch(error => { initialized = undefined; throw error; });
  return initialized;
}
async function read(db: SQLiteDatabase, account: string, id: string): Promise<LocalTrip> {
  const row = await db.getFirstAsync<{ data_json: string }>('SELECT data_json FROM trip_gps_v2_sessions WHERE account_id=? AND session_id=?', account, id);
  if (!row) throw new Error('Không tìm thấy phiên GPS của tài khoản hiện tại.');
  return JSON.parse(row.data_json);
}
async function write(db: SQLiteDatabase, trip: LocalTrip) {
  await db.runAsync(`INSERT INTO trip_gps_v2_sessions(account_id,session_id,trip_id,started_at,data_json) VALUES(?,?,?,?,?)
    ON CONFLICT(account_id,session_id) DO UPDATE SET data_json=excluded.data_json`,
  trip.accountId, trip.session.id, trip.session.tripId, trip.session.startedAt, JSON.stringify(trip));
}
export async function listLocalTrips(account: string, tripId?: string): Promise<LocalTrip[]> {
  await initV2Storage();
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ data_json: string }>(`SELECT data_json FROM trip_gps_v2_sessions WHERE account_id=? ${tripId ? 'AND trip_id=?' : ''} ORDER BY started_at DESC`, ...(tripId ? [account, tripId] : [account]));
  return rows.map(r => JSON.parse(r.data_json));
}
export const readLocalTrip = (account: string, id: string) => exclusive(db => read(db, account, id));
export function changeLocalTrip(account: string, id: string, update: (trip: LocalTrip) => void): Promise<LocalTrip> {
  return exclusive(async db => { const trip = await read(db, account, id); update(trip); await write(db, trip); return trip; });
}
export function saveStartedTrip(account: string, response: SessionResponse): Promise<LocalTrip> {
  return exclusive(async db => {
    if (response.protocolVersion !== 2 || response.session.userId !== account || !response.limits) throw new Error('Contract phiên GPS v2 không hợp lệ.');
    const existing = await db.getFirstAsync<{ data_json: string }>('SELECT data_json FROM trip_gps_v2_sessions WHERE account_id=? AND session_id=?', account, response.session.id);
    if (existing) return JSON.parse(existing.data_json);
    const trip: LocalTrip = { ...response, session: { ...response.session, recordingIntervals: response.session.recordingIntervals?.length ? response.session.recordingIntervals : [{ start: response.session.startedAt, end: response.session.endedAt }] }, protocolVersion: 2, accountId: account, controlSyncMode: 'LOCAL_UNTIL_FINISH', localRevision: 0, metadataRevision: 0,
      sampleSequence: 0, publishSequence: 0, processedMaxSequence: 0, processedRevision: 0,
      syncStatus: 'PENDING', lastError: null, nextRetryAt: null };
    await write(db, trip);
    await db.runAsync('UPDATE trip_gps_v2_cache SET start_id=NULL WHERE account_id=? AND trip_id=?', account, response.session.tripId);
    return trip;
  });
}
export async function readTripCache(account: string, tripId: string) {
  await initV2Storage();
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ context_json: string | null; state_json: string | null }>('SELECT * FROM trip_gps_v2_cache WHERE account_id=? AND trip_id=?', account, tripId);
  return { context: row?.context_json ? JSON.parse(row.context_json) as GpsContextResponse : null,
    state: row?.state_json ? JSON.parse(row.state_json) as GpsStateResponse : null };
}
export function cacheTrip(account: string, tripId: string, context?: GpsContextResponse, state?: GpsStateResponse) {
  return exclusive(async db => {
    await db.runAsync(`INSERT INTO trip_gps_v2_cache(account_id,trip_id,context_json,state_json) VALUES(?,?,?,?)
      ON CONFLICT(account_id,trip_id) DO UPDATE SET context_json=coalesce(excluded.context_json,context_json),state_json=coalesce(excluded.state_json,state_json)`,
    account, tripId, context ? JSON.stringify(context) : null, state ? JSON.stringify(state) : null);
  });
}
export function getStartId(account: string, tripId: string): Promise<string> {
  return exclusive(async db => {
    const row = await db.getFirstAsync<{ start_id: string | null }>('SELECT start_id FROM trip_gps_v2_cache WHERE account_id=? AND trip_id=?', account, tripId);
    if (row?.start_id) return row.start_id;
    const id = generateUUID();
    await db.runAsync(`INSERT INTO trip_gps_v2_cache(account_id,trip_id,start_id) VALUES(?,?,?) ON CONFLICT(account_id,trip_id) DO UPDATE SET start_id=excluded.start_id`, account, tripId, id);
    return id;
  });
}
export function appendSample(account: string, id: string, sample: GpsSample): Promise<boolean> {
  return exclusive(async db => {
    const trip = await read(db, account, id);
    if (trip.session.status !== 'ACTIVE' || trip.accessBlocked) return false;
    const intervals = trip.session.recordingIntervals?.length ? trip.session.recordingIntervals : [{ start: trip.session.startedAt, end: null }];
    const time = Date.parse(sample.recordedAt);
    if (!intervals.some(i => time >= Date.parse(i.start) && (i.end === null || time <= Date.parse(i.end)))) {
      return false;
    }
    const result = await db.runAsync('INSERT OR IGNORE INTO trip_gps_v2_samples(account_id,session_id,sequence,sample_id,payload_json) VALUES(?,?,?,?,?)',
      account, id, trip.sampleSequence + 1, sample.clientSampleId, JSON.stringify(sample));
    if (!result.changes) return false;
    trip.sampleSequence++;
    trip.session.sampleCount++;
    if (trip.syncStatus === 'SYNCED') trip.syncStatus = 'PENDING';
    await write(db, trip);
    return true;
  });
}
export async function localSamples(account: string, id: string): Promise<GpsSample[]> {
  await initV2Storage();
  const db = await getDatabase();
  return (await db.getAllAsync<{ payload_json: string }>('SELECT payload_json FROM trip_gps_v2_samples WHERE account_id=? AND session_id=? ORDER BY sequence', account, id)).map(r => JSON.parse(r.payload_json));
}
export function commitControl(account: string, id: string, action: SyncCommand['action']): Promise<LocalTrip> {
  return exclusive(async db => {
    const trip = await read(db, account, id), session = trip.session;
    if (session.status === 'STOPPED') return trip;
    if ((action === 'PAUSE' && session.status !== 'ACTIVE') || (action === 'RESUME' && session.status !== 'PAUSED')) return trip;
    const latest = await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM trip_gps_v2_samples WHERE account_id=? AND session_id=? ORDER BY sequence DESC LIMIT 1', account, id);
    const intervals = session.recordingIntervals?.length ? session.recordingIntervals : [{ start: session.startedAt, end: null }];
    const occurredAt = new Date(Math.max(Date.now(), Date.parse(session.startedAt),
      ...intervals.flatMap(i => [Date.parse(i.start), ...(i.end ? [Date.parse(i.end)] : [])]),
      ...(latest ? [Date.parse(JSON.parse(latest.payload_json).recordedAt)] : []))).toISOString();
    if (action === 'RESUME') intervals.push({ start: occurredAt, end: null });
    else intervals.forEach(i => { if (!i.end) i.end = occurredAt; });
    session.recordingIntervals = intervals;
    session.status = action === 'RESUME' ? 'ACTIVE' : action === 'PAUSE' ? 'PAUSED' : 'STOPPED';
    if (action === 'FINISH') { session.endedAt = occurredAt; trip.finalMaxSequence = trip.sampleSequence; }
    const command: SyncCommand = { commandId: generateUUID(), sequence: ++trip.localRevision, action, occurredAt };
    await db.runAsync('INSERT INTO trip_gps_v2_commands(account_id,session_id,sequence,payload_json) VALUES(?,?,?,?)', account, id, command.sequence, JSON.stringify(command));
    trip.syncStatus = 'PENDING'; trip.lastError = null;
    await write(db, trip);
    return trip;
  });
}
export function prepareMetadata(account: string, id: string): Promise<SyncMetadata | undefined> {
  return exclusive(async db => {
    const trip = await read(db, account, id);
    if (trip.controlSyncMode === 'LOCAL_UNTIL_FINISH' && trip.session.status !== 'STOPPED') return undefined;
    if (trip.metadata) return trip.metadata;
    if (trip.metadataRevision === trip.localRevision) return undefined;
    const commands: SyncCommand[] = trip.metadataRevision === 0 && trip.controlSyncMode === 'IMMEDIATE_LEGACY' ? [] : (await db.getAllAsync<{ payload_json: string }>(
      'SELECT payload_json FROM trip_gps_v2_commands WHERE account_id=? AND session_id=? AND sequence>? ORDER BY sequence LIMIT ?',
      account, id, trip.metadataRevision, Math.min(100, trip.limits!.maxCommandsPerRequest))).map(r => JSON.parse(r.payload_json));
    const last = commands.at(-1);
    trip.metadata = { requestId: generateUUID(), revision: last?.sequence ?? 1, baseMetadataRevision: trip.metadataRevision, commands,
      recordingStatus: last ? last.action === 'FINISH' ? 'STOPPED' : last.action === 'PAUSE' ? 'PAUSED' : 'ACTIVE' : 'ACTIVE',
      ...(last?.action === 'FINISH' ? { endedAt: last.occurredAt } : {}) };
    await write(db, trip);
    return trip.metadata;
  });
}
export function prepareSnapshot(account: string, id: string): Promise<SnapshotWork | undefined> {
  return exclusive(async db => {
    const trip = await read(db, account, id);
    if (trip.session.status !== 'STOPPED') return undefined;
    if (trip.snapshot) return trip.snapshot;
    if (trip.metadataRevision !== trip.localRevision) return undefined;
    if (trip.finalProcessed) return undefined;
    if (!trip.session.endedAt) throw new Error('Phiên GPS đã dừng nhưng thiếu thời điểm kết thúc. Giữ dữ liệu để kiểm tra.');
    const rows = await db.getAllAsync<{ payload_json: string }>('SELECT payload_json FROM trip_gps_v2_samples WHERE account_id=? AND session_id=? AND sequence>? AND sequence<=? ORDER BY sequence', account, id, trip.processedMaxSequence, trip.sampleSequence);
    if (rows.length > Math.min(10000, trip.limits!.maxSnapshotSamples)) throw new Error('GPS_SNAPSHOT_LIMIT: Giữ dữ liệu trên máy; snapshot vượt giới hạn server.');
    const samples: GpsSample[] = rows.map(r => JSON.parse(r.payload_json));
    const batches: SnapshotWork['batches'] = [];
    const batchSize = Math.min(200, trip.policy.maxBatchSamples, trip.limits!.maxBatchSamples);
    if (batchSize < 1) throw new Error('Giới hạn batch không hợp lệ.');
    for (let offset = 0; offset < samples.length;) {
      let count = Math.min(batchSize, samples.length - offset);
      let payload: SyncBatch;
      do {
        const part = samples.slice(offset, offset + count);
        payload = { batchId: generateUUID(), payloadHash: gpsHash(part), metadataRevision: trip.metadataRevision, snapshotRevision: trip.processedRevision + 1, samples: part };
        if (unescape(encodeURIComponent(JSON.stringify(payload))).length <= Math.min(120000, trip.limits!.maxBodyBytes)) break;
        count = Math.floor(count / 2);
      } while (count > 0);
      if (count < 1) throw new Error('Điểm GPS vượt giới hạn payload.');
      batches.push({ payload: payload! }); offset += count;
    }
    const manifestId = generateUUID(), entries = batches.map(b => ({ batchId: b.payload.batchId, payloadHash: b.payload.payloadHash, sampleCount: b.payload.samples.length }));
    const pageSize = Math.min(100, trip.limits!.maxManifestEntriesPerPage), pageCount = Math.ceil(entries.length / pageSize);
    if (entries.length > 1000 || pageCount > 100) throw new Error('GPS_MANIFEST_LIMIT: Giữ dữ liệu local; manifest vượt giới hạn server.');
    const pages: SnapshotWork['pages'] = [];
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const part = entries.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
      pages.push({ ack: false, payload: { manifestId, snapshotRevision: trip.processedRevision + 1, pageIndex, pageCount, pageHash: gpsHash(part), entries: part } });
    }
    trip.snapshot = { batches, pages, submitted: false, complete: { completionId: generateUUID(), snapshotRevision: trip.processedRevision + 1,
      metadataRevision: trip.metadataRevision, snapshotMaxSequence: trip.sampleSequence, final: true, expectedSampleCount: samples.length,
      manifestId, manifestHash: gpsHash(entries), endedAt: trip.session.endedAt } };
    await write(db, trip);
    return trip.snapshot;
  });
}

export function acknowledgeSnapshot(account: string, id: string): Promise<LocalTrip> {
  return exclusive(async db => {
    const trip = await read(db, account, id), snapshot = trip.snapshot;
    if (!snapshot) return trip;
    await db.runAsync('INSERT INTO trip_gps_v2_snapshots(account_id,session_id,revision,payload_json) VALUES(?,?,?,?) ON CONFLICT(account_id,session_id,revision) DO NOTHING',
      account, id, snapshot.complete.snapshotRevision, JSON.stringify(snapshot));
    trip.processedRevision = snapshot.complete.snapshotRevision; trip.processedMaxSequence = snapshot.complete.snapshotMaxSequence;
    trip.finalProcessed = snapshot.complete.final;
    trip.rejectedSamples = [...(trip.rejectedSamples ?? []), ...snapshot.batches.flatMap(b => b.ack?.rejectedSamples ?? [])];
    trip.snapshot = undefined; trip.lastError = null; trip.nextRetryAt = null; trip.retryCount = 0;
    trip.syncStatus = trip.sampleSequence === trip.processedMaxSequence && trip.localRevision === trip.metadataRevision ? 'SYNCED' : 'PENDING';
    await write(db, trip); return trip;
  });
}
