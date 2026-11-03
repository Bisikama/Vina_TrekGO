const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const source = readFileSync(join(__dirname, 'trip-share.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const share = mod.exports;

test('projection stays inside the insets and keeps north at the top', () => {
  const insets = { top: 10, right: 10, bottom: 30, left: 10 };
  const points = share.projectCoordinates([[106, 10], [106.01, 10.02]], 200, 300, insets);
  for (const p of points) {
    assert.ok(p.x >= 10 && p.x <= 190);
    assert.ok(p.y >= 10 && p.y <= 270);
  }
  assert.ok(points[1].y < points[0].y);
});

test('a route with no span on one axis still projects to finite points', () => {
  const points = share.projectCoordinates([[106, 10], [106, 10.01]], 200, 200, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
});

test('gaps split the route without joining their two ends', () => {
  const segments = share.splitAtGaps([0, 1, 2, 3, 4, 5], [
    { fromCoordinateIndex: 3, toCoordinateIndex: 4 },
    { fromCoordinateIndex: 1, toCoordinateIndex: 2 },
  ]);
  assert.deepEqual(segments, [[0, 1], [2, 3], [4, 5]]);
});

test('single-point fragments next to a gap are dropped', () => {
  assert.deepEqual(share.splitAtGaps([0, 1, 2], [{ fromCoordinateIndex: 0, toCoordinateIndex: 1 }]), [[1, 2]]);
});

test('formats match the design and missing data shows a placeholder', () => {
  assert.equal(share.formatRouteDuration(6119), '1:41:59');
  assert.equal(share.formatRoutePace(10000, 6120), '10:12');
  assert.equal(share.formatRouteDistanceKm(10000), '10.00');
  assert.equal(share.formatRouteDuration(null), '--');
  assert.equal(share.formatRoutePace(10000, null), '--');
  assert.equal(share.formatRoutePace(0, 100), '--');
});
