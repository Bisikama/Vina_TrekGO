/* Run: node --test src/features/trip-gps/hooks/useTripGps.regression.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup(status = 'ACTIVE', fail = false, options = {}) {
  const calls = [];
  const refs = [];
  const memos = [];
  const callbacks = [];
  let stateIndex = 0;
  const fresh = { id: 'session', status, version: 7, startedAt: '2026-01-01T00:00:00.000Z' };
  const react = {
    useState: (initial) => [stateIndex++ === 2 ? { ...fresh, version: 1 } : initial, () => {}],
    useRef: (current) => { const ref = { current }; refs.push(ref); return ref; },
    useCallback: (fn) => { callbacks.push(fn); return fn; },
    useMemo: (fn) => { memos.push(fn); return fn(); },
    useEffect: () => {},
  };
  const api = {
    getGpsSession: async () => ({ session: fresh, policy: {} }),
    finishGpsSession: async (_trip, _session, payload) => {
      calls.push(payload);
      if (fail) throw new Error('Server rejected finish');
      return { session: { ...fresh, status: 'STOPPED' } };
    },
    getMyActualRoute: async () => ({}),
    getGpsContext: async () => ({}),
    ...options.api,
  };
  const storage = {
    getOrCreateDeviceId: async () => 'device',
    saveLocalTripSession: async () => {},
    updateLocalSessionStatus: async () => {},
    pruneCompletedSessionSamples: async () => {},
    getPendingSamples: async () => [],
    getLatestSessionSampleTime: async () => null,
    markSamplesAccepted: async () => {},
    markSamplesRejected: async () => {},
    ...options.storage,
  };
  let resets = 0;
  const loaded = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(`${__dirname}/useTripGps.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, {
    exports: loaded.exports,
    Date: options.Date || Date,
    console: { warn: () => {} },
    require: (name) => {
      if (name === 'react') return react;
      if (name.endsWith('AuthContext')) return { useAuth: () => ({}) };
      if (name.endsWith('trip-gps.api')) return api;
      if (name.endsWith('trip-gps.storage')) return storage;
      if (name.endsWith('gpsProcessor')) return { GpsProcessor: class { reset() { resets++; } } };
      if (name.endsWith('recordingDatabase')) return { generateUUID: () => 'command' };
      if (name.endsWith('api-client')) return { ApiError: Error };
      return {};
    },
  });
  return { hook: loaded.exports.useTripGps('trip'), calls, refs, callbacks, stats: () => memos.at(-1)(), resets: () => resets };
}

test('finish uses the current server version and blocks duplicate presses', async () => {
  const { hook, calls, resets } = setup();
  const first = hook.finishRecording();
  assert.equal(await hook.finishRecording(), false);
  assert.equal(await first, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].expectedVersion, 7);
  assert.equal(resets(), 1);
});

test('an already stopped session completes without another finish command', async () => {
  const { hook, calls } = setup('STOPPED');
  assert.equal(await hook.finishRecording(), true);
  assert.equal(calls.length, 0);
});

test('a failed finish keeps the GPS processor intact and permits retry', async () => {
  const { hook, calls, resets } = setup('ACTIVE', true);
  assert.equal(await hook.finishRecording(), false);
  assert.equal(resets(), 0);
  assert.equal(await hook.finishRecording(), false);
  assert.equal(calls.length, 2);
});

test('finish drains every batch before sending the command and respects the latest sample time', async () => {
  const events = [];
  const samples = [{ clientSampleId: 'one' }, { clientSampleId: 'two' }];
  const latest = '2099-01-01T00:00:00.000Z';
  const { hook, calls } = setup('ACTIVE', false, {
    storage: {
      getPendingSamples: async () => samples.length ? [samples[0]] : [],
      markSamplesAccepted: async () => { samples.shift(); events.push('saved'); },
      getLatestSessionSampleTime: async () => latest,
    },
    api: {
      uploadGpsSamples: async (_trip, _session, payload) => {
        events.push('upload');
        return { acceptedSampleIds: [payload.samples[0].clientSampleId], duplicateSampleIds: [], rejectedSamples: [] };
      },
    },
  });
  assert.equal(await hook.finishRecording(), true);
  assert.deepEqual(events, ['upload', 'saved', 'upload', 'saved']);
  assert.equal(calls[0].occurredAt, latest);
});

test('upload failure prevents finishing and keeps the pending samples for retry', async () => {
  const { hook, calls, resets } = setup('ACTIVE', false, {
    storage: { getPendingSamples: async () => [{ clientSampleId: 'pending' }] },
    api: { uploadGpsSamples: async () => { throw new Error('Offline'); } },
  });
  assert.equal(await hook.finishRecording(), false);
  assert.equal(calls.length, 0);
  assert.equal(resets(), 0);
});

test('finish waits for in-flight SQLite writes and background sync', async () => {
  const { hook, calls, refs } = setup();
  let completeWrite;
  const write = new Promise((resolve) => { completeWrite = resolve; });
  refs.find((ref) => ref.current && typeof ref.current.add === 'function').current.add(write);
  // The first boolean ref is the background sync lock.
  refs.find((ref) => ref.current === false).current = true;
  const result = hook.finishRecording();
  await Promise.resolve();
  assert.equal(calls.length, 0);
  completeWrite();
  await new Promise((resolve) => setImmediate(resolve));
  const waiters = refs.find((ref) => Array.isArray(ref.current)).current;
  assert.equal(waiters.length, 1);
  waiters.splice(0).forEach((resolve) => resolve());
  assert.equal(await result, true);
  assert.equal(calls.length, 1);
});

test('recording time freezes during finish and stays frozen after server confirmation', async () => {
  let now = Date.parse('2026-01-01T00:00:10.000Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  let complete;
  const waiting = new Promise((resolve) => { complete = resolve; });
  const { hook, refs, callbacks, stats, calls } = setup('ACTIVE', false, { Date: Clock });
  refs.find((ref) => ref.current && typeof ref.current.add === 'function').current.add(waiting);
  const result = hook.finishRecording();
  assert.equal(stats().recordingTime, '00:00:10');
  now += 30000;
  // A fresh ACTIVE session snapshot during upload must not restart the clock.
  callbacks[0]({ id: 'session', status: 'ACTIVE', startedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(stats().recordingTime, '00:00:10');
  complete();
  assert.equal(await result, true);
  callbacks[0]({ id: 'session', status: 'STOPPED', startedAt: '2026-01-01T00:00:00.000Z', endedAt: new Clock().toISOString() });
  assert.equal(stats().recordingTime, '00:00:10');
  assert.equal(calls[0].occurredAt, '2026-01-01T00:00:10.000Z');
});

test('failed finish releases the frozen clock for the active recording', async () => {
  const { hook, refs } = setup('ACTIVE', true);
  assert.equal(await hook.finishRecording(), false);
  assert.equal(refs.some((ref) => ref.current && typeof ref.current.durationMs === 'number'), false);
});
