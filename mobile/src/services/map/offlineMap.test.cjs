/* node --test src/services/map/offlineMap.test.cjs */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const lib = require('../../../scripts/offline-map-lib.cjs');

const module_ = { exports: {} };
new Function('module', 'exports', ts.transpileModule(
  fs.readFileSync(path.join(__dirname, 'offlineMapProtocol.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText)(module_, module_.exports);
const { base64Encode, remoteUrlForKey } = module_.exports;

test('tile của vùng thực sự chứa điểm đã cho', () => {
  const [lng, lat] = [106.1658, 11.3851];
  const tiles = lib.tilesForBbox([lng, lat, lng, lat], 15);
  assert.equal(tiles.length, 1);
  const { x, y, z } = tiles[0];
  const latOf = (row) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / 2 ** z))) * 180) / Math.PI;
  const lngOf = (column) => (column / 2 ** z) * 360 - 180;
  assert.ok(lngOf(x) <= lng && lng < lngOf(x + 1));
  assert.ok(latOf(y + 1) <= lat && lat < latOf(y));
});

test('vùng 20 km ở z15 có số tile hợp lý', () => {
  const count = lib.tilesForBbox(lib.bboxAround([107.149, 10.5031], 0.09), 15).length;
  assert.ok(count > 250 && count < 400, `count=${count}`);
});

test('style trong gói dùng trekgo:// và không còn API key', () => {
  const style = {
    glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=SECRET',
    sprite: 'https://api.maptiler.com/sprites/general/sprite',
    sources: { v4: { type: 'vector', url: 'https://api.maptiler.com/tiles/v4/tiles.json?key=SECRET' } },
    layers: [{ source: 'v4' }],
  };
  const packed = lib.packStyle(style, {
    v4: { template: 'https://api.maptiler.com/tiles/v4/{z}/{x}/{y}?key=SECRET', minzoom: 0, maxzoom: 15 },
  });
  assert.ok(!JSON.stringify(packed).includes('SECRET'));
  assert.deepEqual(packed.sources.v4.tiles, ['trekgo://tiles/v4/{z}/{x}/{y}']);
  assert.equal(packed.sources.v4.url, undefined);
  assert.equal(packed.glyphs, 'trekgo://fonts/{fontstack}/{range}.pbf');
});

test('giới hạn zoom theo loại source', () => {
  assert.equal(lib.sourceMaxZoom({ type: 'raster-dem' }, 14), 12);
  assert.equal(lib.sourceMaxZoom({ type: 'vector' }, 14), 14);
  assert.equal(lib.sourceMaxZoom({ type: 'vector' }, 18), 15);
});

test('lấy được font nằm trong biểu thức match', () => {
  const stacks = lib.collectFontstacks({ layers: [
    { layout: { 'text-font': ['Noto Sans Regular'] } },
    { layout: { 'text-font': ['match', ['get', 'class'], 'hamlet', ['literal', ['Roboto Italic', 'Noto Sans Italic']], ['literal', ['Roboto Regular']]] } },
  ] });
  assert.deepEqual(stacks.sort(), ['Noto Sans Regular', 'Roboto Italic,Noto Sans Italic', 'Roboto Regular']);
});

test('mục thiếu trong gói trỏ đúng địa chỉ mạng', () => {
  assert.equal(remoteUrlForKey('style/style.json', 'STYLE', 'K'), 'STYLE');
  assert.equal(remoteUrlForKey('tiles/v4/14/1/2', 'STYLE', 'K'), 'https://api.maptiler.com/tiles/v4/14/1/2?key=K');
  assert.equal(remoteUrlForKey('terrarium/9/1/2.png', 'STYLE', 'K'), 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/9/1/2.png');
  assert.equal(remoteUrlForKey('fonts/Roboto Regular,Noto Sans Regular/0-255.pbf', 'STYLE', 'K'),
    'https://api.maptiler.com/fonts/Roboto%20Regular%2CNoto%20Sans%20Regular/0-255.pbf?key=K');
});

test('base64 khớp chuẩn với mọi độ dài dư', () => {
  for (const length of [0, 1, 2, 3, 4, 1000]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 37) % 256);
    assert.equal(base64Encode(bytes), Buffer.from(bytes).toString('base64'));
  }
});
