/* Run: node --test src/utils/gpsProcessor.regression.test.cjs */
/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, 'gpsProcessor.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
vm.runInThisContext(`(function(exports){${code}\n})`)(loaded.exports);
const { GpsProcessor } = loaded.exports;
const fix = (timestamp, meters = 0, accuracy = 6) => ({
  timestamp,
  coords: { latitude: 10 + meters / 111195, longitude: 106, accuracy, altitude: null, altitudeAccuracy: null, speed: null, heading: null },
});

test('cached positions before the recording and unstable startup fixes never create a route', () => {
  const processor = new GpsProcessor();
  const start = Date.now() - 20000;
  processor.reset(start);
  assert.equal(processor.process(fix(start - 1000)).reason, 'STALE_LOCATION');
  assert.equal(processor.process(fix(start, 50)).accepted, false);
  assert.equal(processor.process(fix(start + 3000, 0)).accepted, false);
  assert.equal(processor.process(fix(start + 6000, 1)).accepted, false);
  const first = processor.process(fix(start + 9000, 2));
  assert.equal(first.accepted, true);
  assert.equal(first.distanceM, 0);
  assert.equal(first.point.timestamp, start + 9000);
  const moved = processor.process(fix(start + 12000, 10));
  assert.equal(moved.accepted, true);
  assert.ok(moved.distanceM > 7 && moved.distanceM < 9);
});

test('poor accuracy resets startup confirmation and a new session requires new fixes', () => {
  const processor = new GpsProcessor();
  const start = Date.now() - 20000;
  processor.reset(start);
  processor.process(fix(start));
  assert.equal(processor.process(fix(start + 1000, 0, 30)).accepted, false);
  assert.equal(processor.process(fix(start + 2000)).accepted, false);
  assert.equal(processor.process(fix(start + 4000)).accepted, false);
  assert.equal(processor.process(fix(start + 6000)).accepted, true);
  processor.reset(start + 10000);
  assert.equal(processor.process(fix(start + 9000)).reason, 'STALE_LOCATION');
  assert.equal(processor.process(fix(start + 11000)).accepted, false);
});
