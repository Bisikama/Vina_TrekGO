"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiClient } from "@/lib/axios";

// Cấu hình URL Web Worker cho MapLibre GL trong Next.js client
if (typeof window !== "undefined") {
  const workerUrl = "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs";
  if (typeof (maplibregl as any).setWorkerUrl === "function") {
    (maplibregl as any).setWorkerUrl(workerUrl);
  }
  if ((maplibregl as any).config) {
    (maplibregl as any).config.WORKER_URL = workerUrl;
  }
}

interface CheckpointItem {
  id: string;
  name: string;
  description?: string | null;
  sequence: number;
  latitude: number;
  longitude: number;
}

interface SystemTrailDetail {
  id: string;
  code: string;
  name: string;
  distanceKm: number;
  elevationGainM?: number | null;
  destination: {
    name: string;
    centerLat?: number | null;
    centerLng?: number | null;
  };
  routeGeojson: any;
  checkpoints: CheckpointItem[];
  bounds?: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null;
  initialCamera?: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  } | null;
}

export function TripRouteReviewMap({
  trailCode = "TRAIL_BADEN_COTDIEN",
}: {
  trailCode?: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [trail, setTrail] = useState<SystemTrailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(true);

  // 1. Gọi API Backend lấy toạ độ GeoJSON & Checkpoints
  useEffect(() => {
    let cancelled = false;

    async function fetchTrailData() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get<SystemTrailDetail>(
          `/api/v1/system-trails/${encodeURIComponent(trailCode)}`
        );
        if (!cancelled) {
          setTrail(res.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Lỗi khi tải toạ độ cung đường:", err);
          setError("Không thể nạp dữ liệu GPS từ Backend");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTrailData();
    return () => {
      cancelled = true;
    };
  }, [trailCode]);

  // 2. Khởi tạo MapLibre khi đã có dữ liệu GPS
  useEffect(() => {
    if (!mapContainerRef.current || !trail) return;

    // Dọn dẹp bản đồ cũ nếu có
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const center: [number, number] = trail.initialCamera?.center || [
      trail.destination.centerLng || 106.1712,
      trail.destination.centerLat || 11.3789,
    ];

    // Nguồn bản đồ nền vệ tinh Esri
    const mapStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        "satellite-tiles": {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
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

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: center,
      zoom: 13.5,
      pitch: is3D ? 60 : 0,
      bearing: -20,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.on("load", () => {
      // A. Nạp 3D Terrain DEM từ AWS Terrarium
      if (!map.getSource("terrain-dem")) {
        map.addSource("terrain-dem", {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
        });
      }

      if (is3D) {
        map.setTerrain({
          source: "terrain-dem",
          exaggeration: 2.0, // Nổi khối sườn núi rõ nét
        });
      }

      // Đổ bóng sườn dốc (Hillshade)
      if (!map.getLayer("hillshading")) {
        map.addLayer({
          id: "hillshading",
          type: "hillshade",
          source: "terrain-dem",
          paint: {
            "hillshade-exaggeration": 0.7,
            "hillshade-shadow-color": "#0B1120",
          },
        });
      }

      // B. Vẽ tuyến đường leo núi GeoJSON
      if (trail.routeGeojson) {
        if (!map.getSource("trail-route")) {
          map.addSource("trail-route", {
            type: "geojson",
            data: trail.routeGeojson,
          });
        }

        // Viền dạ quang
        if (!map.getLayer("trail-glow")) {
          map.addLayer({
            id: "trail-glow",
            type: "line",
            source: "trail-route",
            paint: {
              "line-color": "#FF3D00",
              "line-width": 8,
              "line-opacity": 0.4,
            },
          });
        }

        // Đường nét chính
        if (!map.getLayer("trail-line")) {
          map.addLayer({
            id: "trail-line",
            type: "line",
            source: "trail-route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#FF5722",
              "line-width": 4,
            },
          });
        }
      }

      // C. Cắm mốc Checkpoints
      if (trail.checkpoints && trail.checkpoints.length > 0) {
        trail.checkpoints.forEach((cp) => {
          const isPeak = cp.sequence === trail.checkpoints.length;
          const el = document.createElement("div");
          el.className = `flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-lg text-[11px] font-bold text-white transition-transform hover:scale-125 cursor-pointer ${
            isPeak ? "bg-red-600 ring-2 ring-red-400" : "bg-[#125238]"
          }`;
          el.innerText = `${cp.sequence}`;

          const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(`
            <div style="font-size: 12px; font-weight: bold; color: #0f172a; padding: 2px;">
              ${cp.name}
            </div>
          `);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([cp.longitude, cp.latitude])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });
      }

      // D. Tự động cân chỉnh Camera vừa trọn vẹn tuyến đường
      if (trail.bounds) {
        map.fitBounds(
          [
            [trail.bounds.minLng, trail.bounds.minLat],
            [trail.bounds.maxLng, trail.bounds.maxLat],
          ],
          { padding: 50, duration: 1200 }
        );
      }
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
    };
  }, [trail, is3D]);

  return (
    <div className="relative mt-4 h-80 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
      {/* Container gắn canvas bản đồ */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-900/80 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-400 border-t-transparent" />
          <span className="text-xs font-semibold text-white">
            Đang tải dữ liệu GPS & Địa hình 3D...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/90 p-4 text-center text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Badges thông tin góc trên */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-bold text-emerald-400 backdrop-blur shadow border border-slate-700">
          ● GPS 3D Núi Bà Đen
        </span>
        <button
          type="button"
          onClick={() => setIs3D(!is3D)}
          className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-800 backdrop-blur hover:bg-white transition"
        >
          {is3D ? "Góc nhìn: 3D Mesh" : "Góc nhìn: 2D Flat"}
        </button>
      </div>

      <span className="absolute bottom-3 right-3 z-10 rounded-md bg-slate-950/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur border border-slate-700">
        Đỉnh 986m · Cự ly 4.5km
      </span>
    </div>
  );
}
