// Logic thuần của script tạo gói bản đồ, tách riêng để test được.
const SCHEME = 'trekgo://';
const MAX_TILE_ZOOM = 15;
const MAX_DEM_ZOOM = 12;

function lonToTileX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat, zoom) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

/** bbox = [west, south, east, north] */
function tilesForBbox([west, south, east, north], zoom) {
  const tiles = [];
  for (let x = lonToTileX(west, zoom); x <= lonToTileX(east, zoom); x++) {
    for (let y = latToTileY(north, zoom); y <= latToTileY(south, zoom); y++) {
      tiles.push({ z: zoom, x, y });
    }
  }
  return tiles;
}

function bboxAround([lng, lat], halfSizeDegrees) {
  return [lng - halfSizeDegrees, lat - halfSizeDegrees, lng + halfSizeDegrees, lat + halfSizeDegrees];
}

/** https://api.maptiler.com/tiles/v4/{z}/{x}/{y}?key=abc -> tiles/v4/{z}/{x}/{y} (không còn API key) */
function toPackKey(url) {
  const withoutQuery = url.split('?')[0];
  return withoutQuery.replace(/^https?:\/\/[^/]+\//, '');
}

function fillTile(template, { z, x, y }) {
  return template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

/** Font có thể nằm trong biểu thức ["literal", [...]] nên phải duyệt đệ quy. */
function collectFontstacks(style) {
  const stacks = new Set();
  const isFontList = (value) =>
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
  const visit = (value) => {
    if (!Array.isArray(value)) return;
    if (value[0] === 'literal' && isFontList(value[1])) {
      stacks.add(value[1].join(','));
      return;
    }
    if (isFontList(value) && value[0] !== 'get' && value[0] !== 'match') {
      stacks.add(value.join(','));
      return;
    }
    value.forEach(visit);
  };
  for (const layer of style.layers) visit(layer.layout?.['text-font']);
  return [...stacks];
}

function usedSourceNames(style) {
  return new Set(style.layers.map((layer) => layer.source).filter(Boolean));
}

function sourceMaxZoom(source, nativeMaxZoom) {
  const limit = source.type === 'raster-dem' ? MAX_DEM_ZOOM : MAX_TILE_ZOOM;
  return Math.min(nativeMaxZoom ?? limit, limit);
}

/**
 * Tạo style dùng trong gói: mọi URL đổi sang trekgo:// và không còn API key.
 * resolved[name] = { template, minzoom, maxzoom } lấy từ tiles.json của từng source.
 */
function packStyle(style, resolved) {
  const packed = JSON.parse(JSON.stringify(style));
  for (const [name, info] of Object.entries(resolved)) {
    const source = packed.sources[name];
    delete source.url;
    source.tiles = [SCHEME + toPackKey(info.template)];
    source.minzoom = info.minzoom;
    source.maxzoom = info.maxzoom;
  }
  if (packed.glyphs) packed.glyphs = SCHEME + toPackKey(packed.glyphs);
  if (typeof packed.sprite === 'string') {
    packed.sprite = SCHEME + toPackKey(packed.sprite);
  } else if (Array.isArray(packed.sprite)) {
    packed.sprite = packed.sprite.map((item) => ({ ...item, url: SCHEME + toPackKey(item.url) }));
  }
  return packed;
}

module.exports = {
  MAX_DEM_ZOOM,
  bboxAround,
  collectFontstacks,
  fillTile,
  packStyle,
  sourceMaxZoom,
  tilesForBbox,
  toPackKey,
  usedSourceNames,
};
