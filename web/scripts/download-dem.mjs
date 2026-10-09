import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Công thức chuyển đổi toạ độ địa lý (Lng, Lat) sang Slippy Map Tile (X, Y)
function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

// Cấu hình khu vực mặc định: Núi Bà Đen - Tây Ninh
const DEFAULT_CONFIG = {
  name: 'Núi Bà Đen',
  minLon: 106.13,
  maxLon: 106.22,
  minLat: 11.33,
  maxLat: 11.42,
  minZoom: 11,
  maxZoom: 15,
};

const outBase = path.resolve(__dirname, '../public/tiles/dem');

async function downloadTile(z, x, y) {
  const dir = path.join(outBase, String(z), String(x));
  const file = path.join(dir, `${y}.png`);

  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    return true; // Đã tải trước đó
  }

  fs.mkdirSync(dir, { recursive: true });

  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(file, buffer);
      return true;
    } catch (err) {
      if (attempt === 3) {
        console.error(`❌ Lỗi tải tile ${z}/${x}/${y}:`, err.message);
        return false;
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

async function main() {
  const cfg = DEFAULT_CONFIG;
  console.log(`🚀 Bắt đầu tải Raster DEM độ cao cho: ${cfg.name}`);
  console.log(`📍 Phạm vi: Lng [${cfg.minLon}..${cfg.maxLon}], Lat [${cfg.minLat}..${cfg.maxLat}]`);
  console.log(`🔍 Zoom levels: ${cfg.minZoom} -> ${cfg.maxZoom}`);

  const tasks = [];
  for (let z = cfg.minZoom; z <= cfg.maxZoom; z++) {
    const x1 = lon2tile(cfg.minLon, z);
    const x2 = lon2tile(cfg.maxLon, z);
    const y1 = lat2tile(cfg.maxLat, z);
    const y2 = lat2tile(cfg.minLat, z);
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tasks.push({ z, x, y });
      }
    }
  }

  console.log(`📦 Tổng cộng: ${tasks.length} tiles cần kiểm tra/tải về.`);

  let completed = 0;
  const CONCURRENCY = 6;
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = tasks[index++];
      await downloadTile(current.z, current.x, current.y);
      completed++;
      if (completed % 20 === 0 || completed === tasks.length) {
        const pct = Math.round((completed / tasks.length) * 100);
        console.log(`⏳ Tiến độ: ${completed}/${tasks.length} (${pct}%)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`✅ Hoàn tất! Dữ liệu đã lưu tại: ${outBase}`);
}

main().catch(console.error);
