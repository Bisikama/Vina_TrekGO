/* node --test src/features/trip-gps/services/trip-gps.v2.test.cjs
 * Uses real SQLite via Node 22; native collector/background behavior still needs a device. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createHash, randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

function load(file, overrides = {}, globals = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (name in overrides) return overrides[name];
    throw new Error(`Unexpected import: ${name}`);
  }, console, setTimeout, clearTimeout, Date, ...globals }, { filename: file });
  return module.exports;
}
const hash = load('trip-gps.hash.ts');
const clone = value => JSON.parse(JSON.stringify(value));
class ApiError extends Error { constructor(message, status, code, details, retryable) { super(message); Object.assign(this, { status, code, details, retryable }); } }
function harness() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trekgo-gps-test-'));
  const file = path.join(directory, 'gps.sqlite');
  let sqlite = new DatabaseSync(file);
  const db = {
    execAsync: async sql => sqlite.exec(sql),
    runAsync: async (sql, ...args) => sqlite.prepare(sql).run(...args),
    getFirstAsync: async (sql, ...args) => sqlite.prepare(sql).get(...args) ?? null,
    getAllAsync: async (sql, ...args) => sqlite.prepare(sql).all(...args),
    withExclusiveTransactionAsync: async fn => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await fn(db); sqlite.exec('COMMIT'); } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const reload = () => load('trip-gps.v2-storage.ts', { '@/services/storage/recordingDatabase': { getDatabase: async () => db, generateUUID: randomUUID }, './trip-gps.hash': hash });
  const storage = reload();
  const limits = { maxBatchSamples: 2, maxBodyBytes: 262144, maxCommandsPerRequest: 100, maxManifestEntriesPerPage: 1, maxSnapshotSamples: 10000,
    publishMinIntervalSeconds: 5, publishMinDistanceM: 5, publishMovingMaxIntervalSeconds: 15, retryDelaysSeconds: [5, 15, 30] };
  const response = { protocolVersion: 2, limits, policy: { id: 'policy', maxBatchSamples: 200 }, session: { id: 'session', tripId: 'trip', userId: 'account-a', deviceId: 'device',
    clientSessionId: 'client-session', status: 'ACTIVE', version: 1, startedAt: new Date(Date.now() - 60000).toISOString(), endedAt: null, sampleCount: 0 } };
  const sample = n => ({ clientSampleId: `sample-${n}`, latitude: 10 + n * 0.00001, longitude: 106, accuracyM: 8, recordedAt: new Date(Date.now() - 40000 + n * 1000).toISOString() });
  return { storage, db, response, sample, reload,
    restart: () => { sqlite.close(); sqlite = new DatabaseSync(file); return reload(); },
    close: () => { sqlite.close(); fs.rmSync(directory, { recursive: true }); },
    coordinator: request => {
      const timers = [];
      const mod = load('trip-gps.coordinator.ts', { '@/lib/api-client': { ApiError }, '@/services/storage/recordingDatabase': { generateUUID: randomUUID }, './trip-gps.v2-storage': storage, './trip-gps.sync-api': { gpsSyncRequest: request } },
        { setTimeout: (fn, delay) => { const timer = { fn, delay }; timers.push(timer); return timer; }, clearTimeout: timer => { if (timer) timer.cancelled = true; } });
      const coordinator = new mod.TripGpsCoordinator('account-a', () => true, () => {});
      return { coordinator, timers, run: manual => coordinator.execute('session', { busy: false, retries: 0, rerun: false, cancelled: false }, manual) };
    },
  };
}
async function ready(h, count = 3) {
  await h.storage.saveStartedTrip('account-a', h.response);
  // Explicit fixture for sessions created by the former immediate-control client.
  await h.storage.changeLocalTrip('account-a', 'session', t => { t.controlSyncMode = 'IMMEDIATE_LEGACY'; t.localRevision = 1; });
  for (let n = 1; n <= count; n++) await h.storage.appendSample('account-a', 'session', h.sample(n));
  const metadata = await h.storage.prepareMetadata('account-a', 'session');
  await h.storage.changeLocalTrip('account-a', 'session', t => { t.metadataRevision = metadata.revision; t.metadata = undefined; });
}

async function finished(h, count = 3) {
  await ready(h, count);
  await h.storage.commitControl('account-a', 'session', 'FINISH');
  const metadata = await h.storage.prepareMetadata('account-a', 'session');
  await h.storage.changeLocalTrip('account-a', 'session', t => { t.metadataRevision = metadata.revision; t.metadata = undefined; });
}

test('canonical SHA-256 matches server algorithm, Unicode, number serialization and optional null', () => {
  const values = [[], {}, { z: undefined, b: null, a: 'Tiếng Việt 🏕️' }, [1e-8, -0, 1e21], { b: [{ z: 1, a: 2 }], a: true }];
  for (const value of values) assert.equal(hash.gpsHash(value), createHash('sha256').update(hash.canonicalGpsJson(value)).digest('hex'));
  assert.notEqual(hash.gpsHash({ optional: null }), hash.gpsHash({}));
  assert.equal(hash.gpsHash({ b: 2, a: 1 }), hash.gpsHash({ a: 1, b: 2 }));
});

test('summary always shows SQLite route/count/distance even after server processing', () => {
  const { getTripGpsResult } = load('trip-gps.result.ts', { '@/utils/gpsProcessor': load('../../../utils/gpsProcessor.ts') });
  const local = [[106, 10], [106.001, 10.001]];
  const old = { resultStatus: 'READY', totalDistanceMeters: 9999, pointCount: 900, checkpointProgress: { passed: 5, total: 5 }, routeGeojson: { type: 'LineString', coordinates: [[1, 1], [2, 2]] } };
  for (const status of ['PENDING', 'WAITING_NETWORK', 'SYNCING', 'PROCESSING', 'NEEDS_ATTENTION']) {
    const result = getTripGpsResult(old, status, local, '0.15');
    assert.equal(result.isReady, false);
    assert.equal(result.distanceKm, '0.15'); assert.equal(result.pointCount, 2);
    assert.deepEqual(clone(result.routeCoords), local);
    assert.equal('cpPassed' in result, false);
  }
  const ready = getTripGpsResult(old, 'SYNCED', local, '0.15');
  assert.equal(ready.isReady, true); assert.equal(ready.pointCount, 2); assert.equal(ready.distanceKm, '0.15');
  const empty = getTripGpsResult({ ...old, resultStatus: 'EMPTY', routeGeojson: null, pointCount: 0, totalDistanceMeters: 0 }, 'SYNCED', local, '0.15');
  assert.deepEqual(clone(empty.routeCoords), local); assert.equal(empty.pointCount, 2);
});

test('an active old session with empty intervals still records valid raw points', async () => {
  const h = harness();
  try {
    await h.storage.saveStartedTrip('account-a', h.response);
    await h.storage.changeLocalTrip('account-a', 'session', t => { t.session.recordingIntervals = []; });
    assert.equal(await h.storage.appendSample('account-a', 'session', h.sample(1)), true);
    const paused = await h.storage.commitControl('account-a', 'session', 'PAUSE');
    assert.equal(paused.session.recordingIntervals.length, 1);
    assert.ok(paused.session.recordingIntervals[0].end);
  } finally { h.close(); }
});

test('local summary distance includes old SQLite points but excludes pause and signal gaps', () => {
  const gps = load('../../../utils/gpsProcessor.ts');
  const { getLocalTripDistance } = load('trip-gps.result.ts', { '@/utils/gpsProcessor': gps });
  const base = Date.parse('2020-01-01T00:00:00Z');
  const samples = [0, 5, 10, 15, 100].map((seconds, i) => ({ latitude: 10, longitude: 106 + i * 0.0001, recordedAt: new Date(base + seconds * 1000).toISOString() }));
  const intervals = [{ start: samples[0].recordedAt, end: samples[1].recordedAt }, { start: samples[2].recordedAt, end: null }];
  const expected = gps.distanceMeters(samples[0], samples[1]) + gps.distanceMeters(samples[2], samples[3]);
  assert.ok(Math.abs(getLocalTripDistance(samples, intervals, 15) - expected) < 0.001);
});
test('SQLite migration reruns and preserves legacy tables and pending samples', async () => {
  const h = harness();
  try {
    await h.db.execAsync("CREATE TABLE trip_gps_samples(id TEXT); INSERT INTO trip_gps_samples VALUES('old-pending');");
    await h.storage.initV2Storage(); await h.reload().initV2Storage();
    assert.equal((await h.db.getFirstAsync('SELECT id FROM trip_gps_samples')).id, 'old-pending');
  } finally { h.close(); }
});
test('account isolation and stable start id survive real SQLite restart', async () => {
  const h = harness();
  try {
    const first = await h.storage.getStartId('account-a', 'trip');
    await h.storage.saveStartedTrip('account-a', h.response);
    const other = await h.storage.getStartId('account-b', 'trip');
    assert.notEqual(first, other);
    const restarted = h.restart();
    assert.equal(await restarted.getStartId('account-b', 'trip'), other);
    assert.equal((await restarted.listLocalTrips('account-b')).length, 0);
    await assert.rejects(restarted.readLocalTrip('account-b', 'session'));
    assert.equal((await restarted.listLocalTrips('account-a')).length, 1);
  } finally { h.close(); }
});
test('pause/resume/finish timeline is durable, ordered and never reactivated by replaying start', async () => {
  const h = harness();
  try {
    await ready(h, 1);
    await h.storage.commitControl('account-a', 'session', 'PAUSE');
    assert.equal(await h.storage.appendSample('account-a', 'session', h.sample(2)), false);
    await h.storage.commitControl('account-a', 'session', 'RESUME');
    const stopped = await h.storage.commitControl('account-a', 'session', 'FINISH');
    const restarted = h.restart();
    const replay = await restarted.saveStartedTrip('account-a', h.response);
    assert.equal(replay.session.status, 'STOPPED');
    assert.equal(replay.session.endedAt, stopped.session.endedAt);
    const metadata = await restarted.prepareMetadata('account-a', 'session');
    assert.deepEqual(clone(metadata.commands.map(c => [c.sequence, c.action])), [[2, 'PAUSE'], [3, 'RESUME'], [4, 'FINISH']]);
    assert.equal(metadata.commands.at(-1).occurredAt, metadata.endedAt);
    assert.equal(await restarted.appendSample('account-a', 'session', h.sample(4)), false);
  } finally { h.close(); }
});
test('failed local command transaction rolls back status and command outbox', async () => {
  const h = harness();
  try {
    await ready(h, 0);
    await h.db.execAsync("CREATE TRIGGER fail_command BEFORE INSERT ON trip_gps_v2_commands BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
    await assert.rejects(h.storage.commitControl('account-a', 'session', 'FINISH'), /disk full/);
    const state = await h.storage.readLocalTrip('account-a', 'session');
    assert.equal(state.session.status, 'ACTIVE'); assert.equal(state.session.endedAt, null);
  } finally { h.close(); }
});
test('duplicate producer samples are deduplicated and raw coordinates are preserved', async () => {
  const h = harness();
  try {
    await ready(h, 0); const sample = h.sample(1);
    assert.equal(await h.storage.appendSample('account-a', 'session', sample), true);
    assert.equal(await h.storage.appendSample('account-a', 'session', sample), false);
    assert.equal((await h.storage.readLocalTrip('account-a', 'session')).sampleSequence, 1);
    assert.deepEqual(clone((await h.storage.localSamples('account-a', 'session'))[0]), sample);
  } finally { h.close(); }
});
test('final snapshot IDs, hashes and membership survive restart and reject late GPS points', async () => {
  const h = harness();
  try {
    await finished(h); const snapshot = await h.storage.prepareSnapshot('account-a', 'session');
    assert.equal(await h.storage.appendSample('account-a', 'session', h.sample(4)), false);
    const restarted = h.restart();
    assert.deepEqual(clone(await restarted.prepareSnapshot('account-a', 'session')), clone(snapshot));
    assert.equal(snapshot.complete.expectedSampleCount, 3); assert.equal(snapshot.pages.length, 2);
    for (const batch of snapshot.batches) assert.equal(batch.payload.payloadHash, hash.gpsHash(batch.payload.samples));
  } finally { h.close(); }
});
test('empty final snapshot has no manifest pages and canonical empty hash', async () => {
  const h = harness();
  try {
    await ready(h, 0); await h.storage.commitControl('account-a', 'session', 'FINISH');
    const metadata = await h.storage.prepareMetadata('account-a', 'session');
    await h.storage.changeLocalTrip('account-a', 'session', t => { t.metadataRevision = metadata.revision; t.metadata = undefined; });
    const snapshot = await h.storage.prepareSnapshot('account-a', 'session');
    assert.equal(snapshot.complete.final, true); assert.equal(snapshot.pages.length, 0);
    assert.equal(snapshot.complete.manifestHash, hash.gpsHash([]));
  } finally { h.close(); }
});

test('legacy ACTIVE/PAUSED sync only metadata, never history, including manual retries and SQLite restart', async () => {
  const h = harness();
  try {
    await ready(h);
    const endpoints = [];
    const c = h.coordinator(async (_t, _s, _d, _a, endpoint, payload) => {
      endpoints.push(endpoint);
      assert.equal(endpoint, 'metadata');
      return { metadataRevision: payload.revision, acknowledgedCommandIds: payload.commands.map(c => c.commandId), uploadDeadline: null, recordingStatus: payload.recordingStatus, effectiveEndedAt: payload.endedAt ?? null };
    });
    await c.run(false); await c.run(true);
    assert.equal(endpoints.length, 0);
    assert.equal(await h.storage.prepareSnapshot('account-a', 'session'), undefined);
    await h.storage.commitControl('account-a', 'session', 'PAUSE');
    await c.run(true);
    assert.equal(await h.restart().prepareSnapshot('account-a', 'session'), undefined);
    await c.run(false);
    await h.storage.commitControl('account-a', 'session', 'RESUME');
    await c.run(true);
    assert.deepEqual(endpoints, ['metadata', 'metadata']);
    const state = await h.storage.readLocalTrip('account-a', 'session');
    assert.equal(state.syncStatus, 'PENDING');
    assert.equal(state.snapshot, undefined);
    assert.equal((await h.storage.localSamples('account-a', 'session')).length, 3);
  } finally { h.close(); }
});

test('finish offline survives restart, then FINISH metadata is ACKed before any historical batch', async () => {
  const h = harness();
  try {
    await ready(h);
    const ended = await h.storage.commitControl('account-a', 'session', 'FINISH');
    const offline = h.coordinator(async () => { throw new ApiError('offline', 0); });
    await offline.run(true);
    const restarted = h.restart();
    assert.equal((await restarted.readLocalTrip('account-a', 'session')).session.endedAt, ended.session.endedAt);
    let serverStopped = false;
    const endpoints = [];
    const online = h.coordinator(async (_t, _s, _d, _a, endpoint, payload) => {
      endpoints.push(endpoint);
      if (endpoint.startsWith('status')) return { syncStatus: 'OPEN', processedSnapshotRevision: 0 };
      if (endpoint === 'metadata') {
        assert.equal(payload.recordingStatus, 'STOPPED');
        assert.equal(payload.commands.at(-1).action, 'FINISH');
        serverStopped = true;
        return { metadataRevision: payload.revision, acknowledgedCommandIds: payload.commands.map(c => c.commandId), uploadDeadline: null, recordingStatus: payload.recordingStatus, effectiveEndedAt: payload.endedAt ?? null };
      }
      assert.equal(serverStopped, true);
      if (endpoint === 'batches') return { batchId: payload.batchId, snapshotRevision: 1, acceptedSampleIds: payload.samples.map(p => p.clientSampleId), duplicateSampleIds: [], rejectedSamples: [] };
      if (endpoint === 'manifests/pages') return { manifestId: payload.manifestId, pageIndex: payload.pageIndex, acknowledged: true };
      if (endpoint === 'complete') { assert.equal(payload.final, true); assert.equal(payload.endedAt, ended.session.endedAt); }
      return {};
    });
    await online.run(true);
    assert.ok(endpoints.indexOf('metadata') < endpoints.indexOf('batches'));
    assert.equal((await h.storage.readLocalTrip('account-a', 'session')).syncStatus, 'PROCESSING');
  } finally { h.close(); }
});

test('history is blocked if FINISH ACK has the wrong server status or endedAt', async () => {
  for (const recordingStatus of ['ACTIVE', 'STOPPED']) {
    const h = harness();
    try {
      await h.storage.saveStartedTrip('account-a', h.response);
      await h.storage.commitControl('account-a', 'session', 'FINISH');
      const calls = [];
      const c = h.coordinator(async (_t, _s, _d, _a, endpoint, payload) => {
        calls.push(endpoint);
        if (endpoint.startsWith('status')) return { syncStatus: 'OPEN' };
        assert.equal(endpoint, 'metadata');
        return { metadataRevision: payload.revision, acknowledgedCommandIds: payload.commands.map(c => c.commandId), recordingStatus, effectiveEndedAt: new Date(0).toISOString(), uploadDeadline: null };
      });
      await c.run(true);
      assert.deepEqual(calls, ['status', 'metadata']);
      const state = await h.storage.readLocalTrip('account-a', 'session');
      assert.equal(state.syncStatus, 'NEEDS_ATTENTION');
      assert.equal(state.session.status, 'STOPPED');
      assert.ok(state.metadata);
    } finally { h.close(); }
  }
});

test('runtime manual history and reconnect select stopped sessions; open sessions use metadata only', async () => {
  const trips = ['ACTIVE', 'PAUSED', 'STOPPED'].map(status => ({ session: { id: status, status }, controlSyncMode: 'IMMEDIATE_LEGACY', finalProcessed: false }));
  trips.push({ session: { id: 'new-active', status: 'ACTIVE' }, controlSyncMode: 'LOCAL_UNTIL_FINISH', finalProcessed: false });
  trips.push({ session: { id: 'new-paused', status: 'PAUSED' }, controlSyncMode: 'LOCAL_UNTIL_FINISH', finalProcessed: false });
  const calls = [];
  const runtime = load('trip-gps.runtime.ts', {
    '@/services/storage/recordingDatabase': {}, '@/utils/gpsProcessor': {}, './trip-gps.socket': {},
    './trip-gps.coordinator': {}, './trip-gps.collector': {}, './trip-gps.v2-storage': { listLocalTrips: async () => trips },
  }).tripGpsRuntime;
  runtime.account = 'a'; runtime.coordinator = { trigger: id => calls.push(id) };
  await runtime.sync('trip', true);
  assert.deepEqual(calls, ['STOPPED']);
  calls.length = 0;
  await runtime.syncMetadata('trip');
  assert.deepEqual(calls, ['ACTIVE', 'PAUSED']);
  calls.length = 0;
  await runtime.reconnect();
  assert.deepEqual(calls, ['STOPPED', 'ACTIVE', 'PAUSED']);
});

test('switching to fake cancels a queued real collector startup and repeated fake selection does not restart it', async () => {
  let release, stops = 0, starts = 0;
  const runtime = load('trip-gps.runtime.ts', {
    '@/services/storage/recordingDatabase': {}, '@/utils/gpsProcessor': {}, './trip-gps.socket': {}, './trip-gps.coordinator': {},
    './trip-gps.collector': { setCollectorSimulation: () => {}, stopTripCollector: async () => { if (++stops === 1) await new Promise(resolve => { release = resolve; }); }, startTripCollector: async () => { starts++; } },
    './trip-gps.v2-storage': { listLocalTrips: async () => [{ session: { id: 's', tripId: 't', status: 'ACTIVE' } }] },
  }).tripGpsRuntime;
  runtime.account = 'a'; runtime.token = 'token'; runtime.ensureSocket = () => {};
  const real = runtime.reconcileCollector(true);
  for (let n = 0; !release && n < 20; n++) await Promise.resolve();
  assert.ok(release);
  const fake = runtime.setSimulated(true);
  release();
  await Promise.all([real, fake]);
  assert.equal(starts, 0);
  const previousStops = stops;
  await runtime.setSimulated(true);
  assert.equal(stops, previousStops);
});

test('revoked access stops a trip collector/socket without clearing pending GPS data', async () => {
  const trip = { session: { id: 's', tripId: 't', status: 'ACTIVE' }, rawSamples: ['pending'] };
  const calls = [];
  const runtime = load('trip-gps.runtime.ts', {
    '@/services/storage/recordingDatabase': {}, '@/utils/gpsProcessor': {}, './trip-gps.socket': {},
    './trip-gps.coordinator': {}, './trip-gps.collector': {},
    './trip-gps.v2-storage': { listLocalTrips: async () => [trip], changeLocalTrip: async (_a, _s, fn) => { fn(trip); return trip; } },
  }).tripGpsRuntime;
  runtime.account = 'a';
  runtime.sockets.set('t', { disconnect: () => calls.push('disconnect') });
  runtime.reconcileCollector = async () => calls.push('stop-collector');
  await runtime.denyAccess('t');
  assert.equal(trip.accessBlocked, true);
  assert.equal(trip.session.status, 'ACTIVE', 'revocation must not invent a user FINISH');
  assert.deepEqual(trip.rawSamples, ['pending']);
  assert.deepEqual(calls, ['stop-collector', 'disconnect']);
});

test('an unprocessed old nonfinal snapshot is retained without sending it to the new API', async () => {
  const h = harness();
  try {
    await finished(h);
    const snapshot = await h.storage.prepareSnapshot('account-a', 'session');
    await h.storage.changeLocalTrip('account-a', 'session', t => { t.snapshot.complete.final = false; delete t.snapshot.complete.endedAt; });
    const endpoints = [];
    const c = h.coordinator(async (_t, _s, _d, _a, endpoint) => { endpoints.push(endpoint); return { syncStatus: 'RECEIVING' }; });
    await c.run(true);
    assert.deepEqual(endpoints, ['status?snapshotRevision=1']);
    const state = await h.storage.readLocalTrip('account-a', 'session');
    assert.equal(state.syncStatus, 'NEEDS_ATTENTION');
    assert.equal(state.snapshot.complete.completionId, snapshot.complete.completionId);
    assert.equal((await h.storage.localSamples('account-a', 'session')).length, 3);
  } finally { h.close(); }
});
test('metadata chunks at 100 commands and frozen request survives concurrent controls', async () => {
  const h = harness();
  try {
    await ready(h, 0);
    for (let i = 0; i < 102; i++) await h.storage.commitControl('account-a', 'session', i % 2 ? 'RESUME' : 'PAUSE');
    const first = await h.storage.prepareMetadata('account-a', 'session');
    assert.equal(first.commands.length, 100); assert.equal(first.revision, 101);
    await h.storage.commitControl('account-a', 'session', 'FINISH');
    assert.deepEqual(clone(await h.storage.prepareMetadata('account-a', 'session')), clone(first));
  } finally { h.close(); }
});

test('new sessions never send metadata on start/pause/resume or reconnect; finish flushes sequence 1 onward', async () => {
  const h = harness();
  try {
    const created = await h.storage.saveStartedTrip('account-a', h.response);
    assert.equal(created.controlSyncMode, 'LOCAL_UNTIL_FINISH');
    assert.equal(created.localRevision, 0);
    const calls = [];
    const c = h.coordinator(async (_t, _s, _d, _a, endpoint, payload) => {
      calls.push({ endpoint, payload: clone(payload ?? null) });
      if (endpoint.startsWith('status')) return { syncStatus: 'OPEN' };
      if (endpoint === 'metadata') return { metadataRevision: payload.revision, acknowledgedCommandIds: payload.commands.map(c => c.commandId), uploadDeadline: null, recordingStatus: payload.recordingStatus, effectiveEndedAt: payload.endedAt ?? null };
      if (endpoint === 'complete') { assert.equal(payload.final, true); return {}; }
      throw new Error('Unexpected endpoint ' + endpoint);
    });
    await c.run(true);
    await h.storage.commitControl('account-a', 'session', 'PAUSE');
    await c.run(true);
    assert.equal(await h.storage.prepareMetadata('account-a', 'session'), undefined);
    const reopened = h.restart();
    assert.equal((await reopened.readLocalTrip('account-a', 'session')).session.status, 'PAUSED');
    await c.run(false);
    await reopened.commitControl('account-a', 'session', 'RESUME');
    await c.run(true);
    assert.equal(calls.length, 0);
    await reopened.commitControl('account-a', 'session', 'FINISH');
    await c.run(true);
    const metadata = calls.find(c => c.endpoint === 'metadata').payload;
    assert.deepEqual(metadata.commands.map(c => [c.sequence, c.action]), [[1, 'PAUSE'], [2, 'RESUME'], [3, 'FINISH']]);
    assert.equal(metadata.baseMetadataRevision, 0);
    assert.equal(metadata.recordingStatus, 'STOPPED');
    assert.equal(calls.filter(c => c.endpoint === 'metadata').length, 1);
    assert.equal((await reopened.readLocalTrip('account-a', 'session')).controlSyncMode, 'LOCAL_UNTIL_FINISH');
  } finally { h.close(); }
});

test('migration pins old sessions and unknown in-flight metadata to legacy without rewriting payloads', async () => {
  const h = harness();
  try {
    await ready(h, 0);
    await h.storage.commitControl('account-a', 'session', 'PAUSE');
    const metadata = await h.storage.prepareMetadata('account-a', 'session');
    const old = clone(await h.storage.readLocalTrip('account-a', 'session'));
    delete old.controlSyncMode;
    await h.db.runAsync('UPDATE trip_gps_v2_sessions SET data_json=?', JSON.stringify(old));
    const restarted = h.restart();
    const migrated = await restarted.readLocalTrip('account-a', 'session');
    assert.equal(migrated.controlSyncMode, 'IMMEDIATE_LEGACY');
    assert.deepEqual(clone(migrated.metadata), clone(metadata));
    assert.equal(migrated.localRevision, 2);
    assert.equal(migrated.session.status, 'PAUSED');
    assert.ok(await h.db.getFirstAsync('SELECT version FROM trip_gps_mobile_migrations WHERE version=3'));
    assert.deepEqual(clone(await restarted.prepareMetadata('account-a', 'session')), clone(metadata));
  } finally { h.close(); }
});

test('new finish timeline pages are contiguous and immutable, with FINISH only in the last page', async () => {
  const h = harness();
  try {
    await h.storage.saveStartedTrip('account-a', h.response);
    for (let n = 0; n < 102; n++) await h.storage.commitControl('account-a', 'session', n % 2 ? 'RESUME' : 'PAUSE');
    assert.equal(await h.storage.prepareMetadata('account-a', 'session'), undefined);
    await h.storage.commitControl('account-a', 'session', 'FINISH');
    const first = await h.storage.prepareMetadata('account-a', 'session');
    assert.equal(first.commands.length, 100);
    assert.equal(first.commands[0].sequence, 1);
    assert.equal(first.revision, 100);
    assert.equal(first.commands.some(c => c.action === 'FINISH'), false);
    assert.equal(await h.storage.prepareSnapshot('account-a', 'session'), undefined);
    assert.deepEqual(clone(await h.restart().prepareMetadata('account-a', 'session')), clone(first));
    await h.storage.changeLocalTrip('account-a', 'session', t => { t.metadataRevision = first.revision; t.metadata = undefined; });
    const last = await h.storage.prepareMetadata('account-a', 'session');
    assert.equal(last.baseMetadataRevision, 100);
    assert.equal(last.commands[0].sequence, 101);
    assert.equal(last.commands.at(-1).sequence, 103);
    assert.equal(last.commands.at(-1).action, 'FINISH');
    assert.equal(last.endedAt, last.commands.at(-1).occurredAt);
  } finally { h.close(); }
});
test('lost batch ACK retries identical payload; persisted ACK batches are skipped', async () => {
  const h = harness();
  try {
    await finished(h); const calls = []; let failed = false;
    const c = h.coordinator(async (_trip, _id, _device, _account, endpoint, payload) => {
      calls.push({ endpoint, payload: clone(payload ?? null) });
      if (endpoint.startsWith('status')) return { syncStatus: 'RECEIVING', processedSnapshotRevision: 0 };
      if (endpoint === 'batches') {
        if (payload.samples.length === 1 && !failed) { failed = true; throw new ApiError('lost ACK', 0); }
        return { batchId: payload.batchId, snapshotRevision: 1, acceptedSampleIds: payload.samples.map(p => p.clientSampleId), duplicateSampleIds: [], rejectedSamples: [] };
      }
      if (endpoint === 'manifests/pages') return { manifestId: payload.manifestId, pageIndex: payload.pageIndex, acknowledged: true };
      return {};
    });
    await c.run(false); assert.equal(c.timers[0].delay, 5000);
    await c.run(true);
    const batches = calls.filter(c => c.endpoint === 'batches');
    assert.equal(batches.length, 3); assert.deepEqual(batches[1].payload, batches[2].payload);
    assert.equal((await h.storage.readLocalTrip('account-a', 'session')).syncStatus, 'PROCESSING');
    assert.equal((await h.storage.localSamples('account-a', 'session')).length, 3);
  } finally { h.close(); }
});
test('HTTP 202 is not completion; only matching processed revision archives snapshot', async () => {
  const h = harness();
  try {
    await finished(h); const snap = await h.storage.prepareSnapshot('account-a', 'session');
    await h.storage.changeLocalTrip('account-a', 'session', t => { t.snapshot.submitted = true; });
    let status = { syncStatus: 'PROCESSING', processedSnapshotRevision: 0 };
    const c = h.coordinator(async () => status);
    await c.run(false);
    assert.equal((await h.storage.readLocalTrip('account-a', 'session')).snapshot.complete.completionId, snap.complete.completionId);
    status = { syncStatus: 'COMPLETE', processedSnapshotRevision: 1 };
    await c.run(false);
    const state = await h.storage.readLocalTrip('account-a', 'session');
    assert.equal(state.processedRevision, 1); assert.equal(state.snapshot, undefined);
    assert.equal((await h.db.getAllAsync('SELECT * FROM trip_gps_v2_snapshots')).length, 1);
    assert.equal((await h.storage.localSamples('account-a', 'session')).length, 3);
  } finally { h.close(); }
});
test('worker retry creates a new completion ID without reuploading acknowledged batches', async () => {
  const h = harness();
  try {
    await finished(h); const snap = await h.storage.prepareSnapshot('account-a', 'session');
    await h.storage.changeLocalTrip('account-a', 'session', t => {
      t.snapshot.submitted = true; t.snapshot.batches.forEach(b => { b.ack = { acceptedSampleIds: b.payload.samples.map(p => p.clientSampleId), duplicateSampleIds: [], rejectedSamples: [] }; });
      t.snapshot.pages.forEach(p => { p.ack = true; });
    });
    const calls = [];
    const c = h.coordinator(async (_t, _s, _d, _a, endpoint, payload) => {
      calls.push({ endpoint, payload });
      if (endpoint.startsWith('status')) return { syncStatus: 'NEEDS_ATTENTION', processedSnapshotRevision: 0 };
      return {};
    });
    await c.run(true);
    assert.deepEqual(calls.map(c => c.endpoint), ['status?snapshotRevision=1', 'complete']);
    assert.notEqual(calls[1].payload.completionId, snap.complete.completionId);
    assert.equal(calls[1].payload.manifestHash, snap.complete.manifestHash);
  } finally { h.close(); }
});

test('manual worker retry pressed during a status request is retained and coalesced', async () => {
  const h = harness();
  try {
    await finished(h);
    const original = await h.storage.prepareSnapshot('account-a', 'session');
    await h.storage.changeLocalTrip('account-a', 'session', t => {
      t.snapshot.submitted = true;
      t.snapshot.batches.forEach(b => { b.ack = { acceptedSampleIds: b.payload.samples.map(p => p.clientSampleId), duplicateSampleIds: [], rejectedSamples: [] }; });
      t.snapshot.pages.forEach(p => { p.ack = true; });
    });
    let release, statusCount = 0;
    const completions = [];
    const c = h.coordinator(async (_t, _s, _d, _a, endpoint, payload) => {
      if (endpoint.startsWith('status')) {
        if (++statusCount === 1) await new Promise(resolve => { release = resolve; });
        return { syncStatus: 'NEEDS_ATTENTION', processedSnapshotRevision: 0 };
      }
      assert.equal(endpoint, 'complete'); completions.push(clone(payload)); return {};
    });
    c.coordinator.trigger('session');
    for (let n = 0; !release && n < 100; n++) await new Promise(setImmediate);
    assert.ok(release);
    c.coordinator.trigger('session', true);
    release();
    for (let n = 0; completions.length === 0 && n < 100; n++) await new Promise(setImmediate);
    assert.equal(completions.length, 1);
    assert.notEqual(completions[0].completionId, original.complete.completionId);
    for (let n = 0; c.coordinator.runs.get('session').busy && n < 100; n++) await new Promise(setImmediate);
    c.coordinator.stop();
  } finally { h.close(); }
});

test('a manual retry waiting behind another session retains its manual intent', async () => {
  const h = harness();
  try {
    const c = h.coordinator(async () => { throw new Error('must wait for the current uploader'); });
    c.coordinator.concurrent = 1;
    await c.run(true);
    const calls = [];
    c.coordinator.trigger = (id, manual) => calls.push([id, manual]);
    c.timers[0].fn();
    assert.deepEqual(calls, [['session', true]]);
  } finally { h.close(); }
});

test('collector drain propagates an in-flight SQLite failure instead of confirming Finish', async () => {
  let failWrite;
  const collector = load('trip-gps.collector.ts', {
    'expo-location': {}, 'expo-task-manager': {}, 'react-native': { Platform: { OS: 'web' } },
    '@/features/auth/storage': { readStoredAuth: async () => ({ user: { id: 'a' } }) },
    '@/services/storage/recordingDatabase': { createDeterministicUuid: () => randomUUID() },
    './trip-gps.v2-storage': { readLocalTrip: async () => ({ policy: { maxAcceptedAccuracyM: 50, maxFutureSkewSeconds: 10 } }),
      appendSample: async () => new Promise((_resolve, reject) => { failWrite = reject; }) },
  });
  const write = collector.ingestLocations('a', 'session', [{ timestamp: Date.now(), coords: { latitude: 10, longitude: 106, accuracy: 5 } }], 'SIMULATOR');
  const written = assert.rejects(write, /disk full/);
  for (let n = 0; !failWrite && n < 20; n++) await Promise.resolve();
  assert.ok(failWrite);
  const drain = collector.stopTripCollector();
  const drained = assert.rejects(drain, /disk full/);
  failWrite(new Error('disk full'));
  await Promise.all([written, drained]);
});

test('late real-device callbacks cannot write into a selected fake session', async () => {
  let releaseAuth;
  const saved = [];
  let firstAuth = true;
  const collector = load('trip-gps.collector.ts', {
    'expo-location': {}, 'expo-task-manager': {}, 'react-native': { Platform: { OS: 'web' } },
    '@/features/auth/storage': { readStoredAuth: async () => {
      if (firstAuth) { firstAuth = false; await new Promise(resolve => { releaseAuth = resolve; }); }
      return { user: { id: 'a' } };
    } },
    '@/services/storage/recordingDatabase': { createDeterministicUuid: () => randomUUID() },
    './trip-gps.v2-storage': { readLocalTrip: async () => ({ policy: { maxAcceptedAccuracyM: 50, maxFutureSkewSeconds: 10 } }),
      appendSample: async (_a, _s, point) => { saved.push(point); return true; } },
  });
  const point = longitude => ({ timestamp: Date.now(), coords: { latitude: 10, longitude, accuracy: 5 } });
  const staleReal = collector.ingestLocations('a', 's', [point(100)]);
  for (let n = 0; !releaseAuth && n < 20; n++) await Promise.resolve();
  collector.setCollectorSimulation(true);
  releaseAuth(); await staleReal;
  assert.equal(saved.length, 0);
  await collector.ingestLocations('a', 's', [point(106)], 'SIMULATOR');
  assert.equal(saved.length, 1); assert.equal(saved[0].longitude, 106);
  collector.setCollectorSimulation(false);
  await collector.ingestLocations('a', 's', [point(107)], 'DEVICE');
  assert.equal(saved.length, 1);
});
test('retry budget persists across restart and stops after initial attempt plus three retries', async () => {
  const h = harness();
  try {
    await finished(h); let requests = 0;
    const c = h.coordinator(async () => { requests++; throw new ApiError('P2028', 503, 'GPS_SYNC_UNAVAILABLE', {}, true); });
    for (let i = 0; i < 4; i++) {
      await h.storage.changeLocalTrip('account-a', 'session', t => { t.nextRetryAt = null; });
      // The fourth request represents the due third retry, before marking it exhausted.
      if (i === 3) await h.storage.changeLocalTrip('account-a', 'session', t => { t.nextRetryAt = new Date(Date.now() - 1).toISOString(); });
      await c.run(false);
    }
    assert.equal(requests, 4);
    assert.deepEqual(c.timers.filter(t => !t.cancelled).map(t => t.delay), [5000, 15000, 30000]);
    assert.equal((await h.restart().readLocalTrip('account-a', 'session')).nextRetryAt, null);
    await c.run(false); assert.equal(requests, 4);
  } finally { h.close(); }
});
test('403 blocks publishing/collection, keeps raw samples and does not retry', async () => {
  const h = harness();
  try {
    await finished(h);
    const c = h.coordinator(async () => { throw new ApiError('revoked', 403, 'GPS_ACCESS_REVOKED'); });
    await c.run(false);
    assert.equal((await h.storage.readLocalTrip('account-a', 'session')).accessBlocked, true);
    assert.equal(c.timers.length, 0);
    assert.equal((await h.storage.localSamples('account-a', 'session')).length, 3);
  } finally { h.close(); }
});

test('paginated missing batches replay original payloads from the immutable snapshot', async () => {
  const h = harness();
  try {
    await finished(h);
    const snapshot = await h.storage.prepareSnapshot('account-a', 'session');
    await h.storage.changeLocalTrip('account-a', 'session', t => {
      t.snapshot.batches.forEach(b => { b.ack = { acceptedSampleIds: b.payload.samples.map(p => p.clientSampleId), duplicateSampleIds: [], rejectedSamples: [] }; });
      t.snapshot.pages.forEach(p => { p.ack = true; });
    });
    const uploaded = [], queries = [];
    const c = h.coordinator(async (_t, _s, _d, _a, endpoint, payload) => {
      if (endpoint.startsWith('status')) {
        queries.push(endpoint);
        const second = endpoint.includes('cursor=1');
        return { syncStatus: 'RECEIVING', missingBatchIds: [snapshot.batches[second ? 1 : 0].payload.batchId], nextCursor: second ? null : 1 };
      }
      if (endpoint === 'batches') {
        uploaded.push(clone(payload));
        return { batchId: payload.batchId, snapshotRevision: 1, acceptedSampleIds: [], duplicateSampleIds: payload.samples.map(p => p.clientSampleId), rejectedSamples: [] };
      }
      return {};
    });
    await c.run(true);
    assert.equal(queries.length, 2);
    assert.deepEqual(uploaded, clone(snapshot.batches.map(b => b.payload)));
  } finally { h.close(); }
});
test('location/presence merge independently from roster and ignore old events across sessions', () => {
  const merge = load('trip-gps.merge.ts');
  const old = { userId: 'u', memberVersion: 5, locationVersion: 20, presenceVersion: 9, connectionStatus: 'OFFLINE', lastLocation: { latitude: 1 }, fullName: 'old' };
  const incoming = { ...old, memberVersion: 6, locationVersion: 19, presenceVersion: 8, connectionStatus: 'ONLINE', lastLocation: { latitude: 0 }, fullName: 'new' };
  const result = merge.mergeMember(old, incoming);
  assert.equal(result.fullName, 'new'); assert.equal(result.lastLocation.latitude, 1); assert.equal(result.connectionStatus, 'OFFLINE');
  assert.equal(merge.patchLocation(result, { userId: 'u', locationVersion: 19, location: { latitude: 0 } }), result);
  assert.equal(merge.patchLocation(result, { userId: 'u', sessionId: 'new-session', locationVersion: 21, location: { latitude: 2 } }).lastLocation.latitude, 2);
});

test('publisher adapts at 5 s / 5 m / 15 s, keeps one pending point and persists sequence', async () => {
  let now = Date.now(), release;
  const calls = [], state = { session: { id: 's', status: 'ACTIVE' }, publishSequence: 40 };
  class FakeDate extends Date { static now() { return now; } }
  const runtime = load('trip-gps.runtime.ts', {
    '@/services/storage/recordingDatabase': { generateUUID: randomUUID },
    '@/utils/gpsProcessor': { GpsProcessor: class { process() { return { accepted: true }; } }, distanceMeters: (a, b) => Math.abs(a.latitude - b.latitude) * 111000 },
    './trip-gps.socket': {}, './trip-gps.coordinator': {}, './trip-gps.collector': {},
    './trip-gps.v2-storage': { changeLocalTrip: async (_a, _s, fn) => { fn(state); return state; } },
  }, { Date: FakeDate }).tripGpsRuntime;
  runtime.account = 'a';
  const trip = { accountId: 'a', session: { id: 's', tripId: 't', status: 'ACTIVE', deviceId: 'd' },
    policy: { liveLocationMaxAgeSeconds: 60, maxFutureSkewSeconds: 10 }, limits: { publishMinIntervalSeconds: 5, publishMinDistanceM: 5, publishMovingMaxIntervalSeconds: 15 } };
  let defer = false;
  runtime.sockets.set('t', { isConnected: () => true, publish: async payload => {
    calls.push(clone(payload));
    if (defer) await new Promise(resolve => { release = resolve; });
    return { applied: true };
  } });
  const point = (metres, id) => ({ clientSampleId: id, latitude: 10 + metres / 111000, longitude: 106, accuracyM: 5, recordedAt: new Date(now).toISOString() });
  await runtime.offer(trip, point(0, 'first'));
  now += 4000; await runtime.offer(trip, point(10, 'too-soon')); assert.equal(calls.length, 1);
  now += 1000; await runtime.offer(trip, point(10, 'five-seconds')); assert.equal(calls.length, 2);
  now += 5000; await runtime.offer(trip, point(12, 'slow-early')); assert.equal(calls.length, 2);
  now += 10000; await runtime.offer(trip, point(12, 'slow-fifteen')); assert.equal(calls.length, 3);
  now += 20000; await runtime.offer(trip, point(12, 'stationary')); assert.equal(calls.length, 3);
  defer = true; const pending = runtime.offer(trip, point(30, 'awaiting-ack'));
  await Promise.resolve(); await Promise.resolve();
  now += 1000; await runtime.offer(trip, point(31, 'discard-me'));
  now += 1000; await runtime.offer(trip, point(32, 'latest-only'));
  assert.equal(runtime.publishers.get('s').pending.clientSampleId, 'latest-only');
  release(); await pending;
  assert.equal(calls.at(-1).sequence, 44);
  runtime.account = 'b'; now += 10000; await runtime.offer(trip, point(40, 'old-account'));
  assert.equal(calls.length, 4);
  runtime.account = 'a'; defer = false;
  state.controlSyncMode = 'IMMEDIATE_LEGACY'; state.localRevision = 3; state.metadataRevision = 2;
  await runtime.offer(trip, point(50, 'resume-not-acked'), true);
  assert.equal(calls.length, 4);
  state.metadataRevision = 3;
  await runtime.offer(trip, point(51, 'resume-acked'), true);
  assert.equal(calls.length, 5);
});

test('generated mobile requests validate against the referenced server DTOs', { skip: !process.env.TRIP_GPS_SERVER_ROOT }, async () => {
  const root = path.resolve(process.env.TRIP_GPS_SERVER_ROOT);
  const { createRequire } = require('node:module');
  const serverRequire = createRequire(path.join(root, 'package.json'));
  const modules = new Map();
  function dto(file) {
    if (modules.has(file)) return modules.get(file);
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(source, { exports: module.exports, module, require: name => name.startsWith('.') ? dto(path.resolve(path.dirname(file), name + '.ts')) : serverRequire(name) });
    modules.set(file, module.exports); return module.exports;
  }
  const schema = dto(path.join(root, 'src/modules/geo/presentation/dtos/trip-gps-sync.dto.ts'));
  const h = harness();
  try {
    await h.storage.saveStartedTrip('account-a', h.response);
    await h.storage.appendSample('account-a', 'session', { ...h.sample(1), clientSampleId: randomUUID(), altitudeM: null });
    assert.equal(await h.storage.prepareMetadata('account-a', 'session'), undefined);
    await h.storage.commitControl('account-a', 'session', 'PAUSE');
    await h.storage.commitControl('account-a', 'session', 'RESUME');
    await h.storage.commitControl('account-a', 'session', 'FINISH');
    const commands = await h.storage.prepareMetadata('account-a', 'session');
    schema.syncMetadataSchema.parse(clone(commands));
    await h.storage.changeLocalTrip('account-a', 'session', t => { t.metadataRevision = commands.revision; t.metadata = undefined; });
    const snapshot = await h.storage.prepareSnapshot('account-a', 'session');
    snapshot.batches.forEach(b => schema.syncBatchSchema.parse(clone(b.payload)));
    snapshot.pages.forEach(p => schema.syncManifestSchema.parse(clone(p.payload)));
    schema.syncCompleteSchema.parse(clone(snapshot.complete));
    assert.equal(schema.syncCompleteSchema.safeParse({ ...clone(snapshot.complete), final: false }).success, false);
    const missingEnd = clone(snapshot.complete); delete missingEnd.endedAt;
    assert.equal(schema.syncCompleteSchema.safeParse(missingEnd).success, false);
  } finally { h.close(); }
});
