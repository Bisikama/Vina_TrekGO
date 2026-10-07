import * as maplibregl from "maplibre-gl";

// Cấu hình URL Web Worker cho MapLibre GL trong môi trường Next.js
if (typeof window !== "undefined") {
  const workerUrl = "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs";
  if (typeof (maplibregl as any).setWorkerUrl === "function") {
    (maplibregl as any).setWorkerUrl(workerUrl);
  }
  if ((maplibregl as any).config) {
    (maplibregl as any).config.WORKER_URL = workerUrl;
  }
}

/**
 * Lấy URL của nguồn DEM độ cao (Terrarium)
 * Tự động ưu tiên local static tiles (/tiles/dem/...) nếu là khu vực Núi Bà Đen
 */
export function getDemTileUrl(isBaDen = false): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (isBaDen && origin) {
    return `${origin}/tiles/dem/{z}/{x}/{y}.png`;
  }
  return "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
}

export const DEFAULT_SATELLITE_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

export function getSatelliteStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      "satellite-tiles": {
        type: "raster",
        tiles: DEFAULT_SATELLITE_TILES,
        tileSize: 256,
        attribution: "© Esri World Imagery",
      },
    },
    layers: [
      {
        id: "satellite-layer",
        type: "raster",
        source: "satellite-tiles",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}
