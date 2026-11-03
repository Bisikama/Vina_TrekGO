// Tạo assets/maps/offline-map.db chứa sẵn bản đồ các khu vực demo. Chạy: npm run map:build
// Chạy lại sẽ bỏ qua dữ liệu đã có, nên đứt mạng thì chỉ cần chạy tiếp.
// Sau khi tạo lại gói, tăng OFFLINE_MAP_PACK_VERSION trong src/services/map/offlineMapPack.ts.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const lib = require('./offline-map-lib.cjs');

const REGIONS = [
  { name: 'Núi Bà Đen', center: [106.1658, 11.3851] },
  { name: 'Núi Dinh', center: [107.149, 10.5031] },
];
const HALF_SIZE_DEGREES = 0.09; // khoảng 20 x 20 km
const MIN_ZOOM = 5;
const CONCURRENCY = 8;
const MAX_FILE_BYTES = 90 * 1024 * 1024; // GitHub chặn file trên 100 MB
const GLYPH_RANGES = ['0-255', '256-511', '768-1023', '7680-7935', '8192-8447'];
const TERRARIUM_TEMPLATE = 'terrarium/{z}/{x}/{y}.png';

const apiKey = process.env.EXPO_PUBLIC_MAPTILER_API_KEY?.trim();
const styleId = process.env.EXPO_PUBLIC_MAPTILER_STYLE_ID?.trim();
if (!apiKey || !styleId) {
  console.error('Thiếu EXPO_PUBLIC_MAPTILER_API_KEY hoặc EXPO_PUBLIC_MAPTILER_STYLE_ID trong .env');
  process.exit(1);
}

const outputFile = path.join(__dirname, '..', 'assets', 'maps', 'offline-map.db');
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
const db = new DatabaseSync(outputFile);
db.exec('CREATE TABLE IF NOT EXISTS resources (key TEXT PRIMARY KEY, data BLOB NOT NULL) WITHOUT ROWID');
const hasKey = db.prepare('SELECT 1 FROM resources WHERE key = ?');
const insert = db.prepare('INSERT OR REPLACE INTO resources (key, data) VALUES (?, ?)');

const insertEmpty = db.prepare("INSERT OR REPLACE INTO resources (key, data) VALUES (?, x'')");

const withKey = (url) => `${url}${url.includes('?') ? '&' : '?'}key=${apiKey}`;
const redact = (text) => String(text).split(apiKey).join('<KEY>');

async function fetchWithRetry(url, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 204 || response.status === 404) return new Uint8Array(0);
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt >= attempts) throw new Error(`${redact(url)}: ${redact(error.message)}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

const fetchJson = async (url) => JSON.parse(Buffer.from(await fetchWithRetry(url)).toString('utf8'));

async function downloadAll(jobs) {
  const pending = jobs.filter((job) => !hasKey.get(job.key));
  console.log(`Tổng ${jobs.length} mục, cần tải ${pending.length}.`);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < pending.length) {
        const job = pending[next++];
        const data = await fetchWithRetry(job.url);
        // node:sqlite ghi mảng rỗng thành NULL, nên tile rỗng phải chèn riêng.
        if (data.length === 0) insertEmpty.run(job.key);
        else insert.run(job.key, data);
        if (++done % 200 === 0) console.log(`  ${done}/${pending.length}`);
      }
    }),
  );
}

async function main() {
  const style = await fetchJson(withKey(`https://api.maptiler.com/maps/${encodeURIComponent(styleId)}/style.json`));
  const jobs = [];
  const seen = new Set();
  const addJob = (key, url) => {
    if (!seen.has(key)) {
      seen.add(key);
      jobs.push({ key, url });
    }
  };
  const addTiles = (keyTemplate, urlTemplate, minzoom, maxzoom) => {
    for (const region of REGIONS) {
      const bbox = lib.bboxAround(region.center, HALF_SIZE_DEGREES);
      for (let zoom = Math.max(minzoom, MIN_ZOOM); zoom <= maxzoom; zoom++) {
        for (const tile of lib.tilesForBbox(bbox, zoom)) {
          addJob(lib.fillTile(keyTemplate, tile), lib.fillTile(urlTemplate, tile));
        }
      }
    }
  };

  const resolved = {};
  for (const name of lib.usedSourceNames(style)) {
    const source = style.sources[name];
    const tileJson = source.url ? await fetchJson(source.url) : source;
    const template = tileJson.tiles[0];
    const minzoom = tileJson.minzoom ?? 0;
    const maxzoom = lib.sourceMaxZoom(source, tileJson.maxzoom);
    resolved[name] = { template, minzoom, maxzoom };
    addTiles(lib.toPackKey(template), withKey(template.split('?')[0]), minzoom, maxzoom);
  }

  addTiles(
    TERRARIUM_TEMPLATE,
    'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    5,
    lib.MAX_DEM_ZOOM,
  );

  const spriteUrl = typeof style.sprite === 'string' ? style.sprite : null;
  if (spriteUrl) {
    for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) {
      addJob(lib.toPackKey(spriteUrl) + suffix, withKey(spriteUrl.split('?')[0] + suffix));
    }
  }

  for (const stack of lib.collectFontstacks(style)) {
    for (const range of GLYPH_RANGES) {
      addJob(
        `fonts/${stack}/${range}.pbf`,
        withKey(`https://api.maptiler.com/fonts/${encodeURIComponent(stack)}/${range}.pbf`),
      );
    }
  }

  await downloadAll(jobs);

  const packed = JSON.stringify(lib.packStyle(style, resolved));
  if (packed.includes(apiKey)) throw new Error('Style trong gói vẫn còn API key.');
  insert.run('style/style.json', Buffer.from(packed, 'utf8'));

  db.exec('VACUUM');
  const { count, empty } = db
    .prepare('SELECT COUNT(*) AS count, SUM(LENGTH(data) = 0) AS empty FROM resources')
    .get();
  db.close();

  const size = fs.statSync(outputFile).size;
  console.log(`Xong: ${count} mục (${empty} rỗng), ${(size / 1024 / 1024).toFixed(1)} MB.`);
  if (size > MAX_FILE_BYTES) {
    console.error('File vượt 90 MB: giảm HALF_SIZE_DEGREES hoặc mức zoom rồi xoá file và chạy lại.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(redact(error.message));
  process.exit(1);
});
