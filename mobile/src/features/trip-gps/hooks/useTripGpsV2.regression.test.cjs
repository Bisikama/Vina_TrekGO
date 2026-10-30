const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, deps, globals) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: id => { if (id in deps) return deps[id]; throw new Error(id); }, process, console, ...globals });
  return module.exports;
}
test('fake GPS retains progress across context refresh/pause and clock runs with empty server intervals', async () => {
  let now = Date.now(), token = 'token', created = 0, failControl = false;
  const timers = new Map(), points = [];
  class Clock extends Date { static now() { return now; } }
  const globals = { Date: Clock, setInterval: fn => { const id = {}; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id) };
  const gps = load('../../../utils/gpsProcessor.ts', {}, globals);
  const Actual = load('../../../services/location/tripGpsSimulator.ts', { '@/utils/gpsProcessor': gps }, globals).TripGpsSimulator;
  class Simulator extends Actual { constructor(options) { super(options); created++; } }
  const states = [], refs = [], memos = [], effects = [];
  let si, ri, mi, ei, pending;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = si++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(value) { return refs[ri++] ??= { current: value }; },
    useMemo(fn, deps) { const i = mi++; if (!equal(memos[i]?.deps, deps)) memos[i] = { deps, value: fn() }; return memos[i].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const i = ei++; if (!equal(effects[i]?.deps, deps)) pending.push({ i, fn, deps }); },
  };
  const syncCalls = [];
  const modes = [];
  const runtime = { setSimulated: async value => { modes.push(value); }, suspendCollector: async () => {}, reconcileCollector: async () => {}, sync: async () => { syncCalls.push('history'); } };
  const hook = load('useTripGpsV2.ts', {
    react, '@/features/auth/AuthContext': { useAuth: () => ({ user: { id: 'a' }, accessToken: token, isLoading: false }) },
    '@/lib/api-client': { ApiError: class extends Error {} }, '@/utils/gpsProcessor': gps,
    '@/utils/mapMatching': { snapToRoute: () => ({ snapped: false }) }, '@/services/location/tripGpsSimulator': { TripGpsSimulator: Simulator },
    './useTripGps': { useTripGps: () => ({}) }, '../services/trip-gps.api': {}, '../services/trip-gps.storage': {},
    '../services/trip-gps.result': { getLocalTripDistance: () => 0 },
    '../services/trip-gps.v2-storage': { localSamples: async () => points.map((p, i) => ({ clientSampleId: String(i), recordedAt: new Date(p.timestamp).toISOString(), ...p.coords })), commitControl: async (_a, _s, action) => {
      if (failControl) throw new Error('disk full');
      return { ...states[0], session: { ...states[0].session, status: action === 'FINISH' ? 'STOPPED' : action === 'PAUSE' ? 'PAUSED' : 'ACTIVE', endedAt: action === 'FINISH' ? new Date(now).toISOString() : null } };
    } }, '../services/trip-gps.merge': {},
    '../services/trip-gps.collector': { ingestLocations: async (_a, _s, samples) => { points.push(...samples); } },
    '../services/trip-gps.runtime': { tripGpsRuntime: runtime },
  }, globals).useTripGps;
  const started = { accountId: 'a', session: { id: 's', tripId: 't', status: 'ACTIVE', startedAt: new Date(now).toISOString(), endedAt: null, recordingIntervals: [] }, policy: { sampleIntervalSeconds: 1 } };
  states[0] = null;
  states[1] = { owner: 'a', value: { tripId: 't', permissions: { canViewGroupLocations: true }, routePlans: [{ geometry: { type: 'LineString', coordinates: [[106, 10], [106, 10.01]] } }], checkpoints: [] } };
  states[9] = true;
  async function render() {
    si = ri = mi = ei = 0; pending = [];
    const result = hook('t');
    const scheduled = pending.map(p => p.fn.toString());
    for (const p of pending) effects[p.i]?.cleanup?.();
    for (const p of pending) {
      // Exercise simulator, clock and identity refs; network restoration is outside this regression.
      const source = p.fn.toString();
      const cleanup = /simulatorRef|setSimulated|setClock|active.current|refreshNetworkRef.current =/.test(source) ? p.fn() : undefined;
      effects[p.i] = { deps: p.deps, cleanup };
    }
    await Promise.resolve(); await Promise.resolve();
    return { result, scheduled };
  }
  await render();
  states[0] = started;
  await render();
  assert.equal(modes.includes(false), false, 'creating a session must not turn fake mode off');
  now += 5000; for (const fn of [...timers.values()]) fn();
  let output = await render();
  assert.equal(output.result.stats.recordingTime, '00:00:05');
  const before = points.at(-1).coords.latitude;
  states[1] = JSON.parse(JSON.stringify(states[1]));
  await render();
  assert.equal(created, 1);
  now += 1000; for (const fn of [...timers.values()]) fn();
  assert.ok(points.at(-1).coords.latitude > before);
  const progressed = points.at(-1).coords.latitude;
  states[0] = { ...states[0], session: { ...states[0].session, status: 'PAUSED' } };
  await render();
  states[0] = { ...states[0], session: { ...states[0].session, status: 'ACTIVE' } };
  await render();
  assert.equal(created, 1);
  assert.ok(points.at(-1).coords.latitude >= progressed);
  token = 'refreshed-token'; output = await render();
  assert.equal(output.scheduled.some(source => source.includes('readTripCache')), false);
  failControl = true;
  await output.result.pauseRecording();
  output = await render();
  const beforeFailureRecovery = points.at(-1).coords.latitude;
  now += 1000; for (const fn of [...timers.values()]) fn();
  assert.ok(points.at(-1).coords.latitude > beforeFailureRecovery, 'failed pause must resume the active fake producer');
  assert.equal(await output.result.finishRecording(), false);
  assert.equal(syncCalls.length, 0, 'failed SQLite finish must not upload or show successful completion');
  failControl = false;
  output = await render();
  assert.equal(await output.result.finishRecording(), true);
  output = await render();
  assert.equal(output.result.session.status, 'STOPPED');
  assert.equal(output.result.summaryRouteCoords.length, points.length);
  const frozenTime = output.result.stats.recordingTime, countAtFinish = points.length;
  now += 5000; for (const fn of [...timers.values()]) fn();
  output = await render();
  assert.equal(output.result.stats.recordingTime, frozenTime);
  assert.equal(points.length, countAtFinish);
  assert.deepEqual(syncCalls, ['history']);
  effects.forEach(effect => effect?.cleanup?.());
});

test('starting fake GPS persists the session and selects simulation before enabling collectors', async () => {
  const calls = [];
  let releaseOldRead, reads = 0;
  let stateIndex = 0;
  const react = {
    useState(initial) {
      const i = stateIndex++;
      const value = typeof initial === 'function' ? initial() : initial;
      return [value, () => { if (i === 0) calls.push('show-session'); }];
    },
    useRef: current => ({ current }), useCallback: fn => fn, useMemo: fn => fn(), useEffect: () => {},
  };
  const session = { id: 's', tripId: 't', userId: 'a', status: 'ACTIVE', recordingIntervals: [], startedAt: new Date().toISOString() };
  const hook = load('useTripGpsV2.ts', {
    react, '@/features/auth/AuthContext': { useAuth: () => ({ user: { id: 'a' }, accessToken: 'token', isLoading: false }) },
    '@/lib/api-client': { ApiError: class extends Error {} }, '@/utils/gpsProcessor': { GpsProcessor: class {} }, '@/utils/mapMatching': {},
    '@/services/location/tripGpsSimulator': {}, './useTripGps': { useTripGps: () => ({}) },
    '../services/trip-gps.api': { getGpsContext: async () => ({ permissions: { canStartNewSession: true }, capabilities: { supportedSyncProtocols: [2] } }),
      startGpsSession: async () => { calls.push('start-api'); return { session }; } },
    '../services/trip-gps.storage': { getOrCreateDeviceId: async () => 'device' },
    '../services/trip-gps.v2-storage': { cacheTrip: async () => {}, listLocalTrips: async () => {
      if (++reads === 1) return new Promise(resolve => { releaseOldRead = resolve; });
      return [];
    }, getStartId: async () => 'start-id',
      saveStartedTrip: async () => { calls.push('save-sqlite'); return { accountId: 'a', session }; } },
    '../services/trip-gps.merge': {}, '../services/trip-gps.collector': {}, '../services/trip-gps.result': { getLocalTripDistance: () => 0 },
    '../services/trip-gps.runtime': { tripGpsRuntime: { setSimulated: async value => { assert.equal(value, true); calls.push('fake-mode'); },
      reconcileCollector: async () => { calls.push('collector'); } } },
  }, { Date }).useTripGps;
  const gps = hook('t');
  const oldRefresh = gps.refreshState();
  await gps.startRecording();
  releaseOldRead([]);
  await oldRefresh;
  assert.deepEqual(calls, ['start-api', 'save-sqlite', 'fake-mode', 'show-session', 'collector']);
});


