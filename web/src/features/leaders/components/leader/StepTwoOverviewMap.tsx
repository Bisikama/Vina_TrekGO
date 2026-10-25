"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiClient } from "@/lib/axios";

// Cấu hình URL Web Worker cho MapLibre GL trong Next.js client
if (typeof window !== "undefined") {
  const workerUrl =
    "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs";
  if (typeof (maplibregl as any).setWorkerUrl === "function") {
    (maplibregl as any).setWorkerUrl(workerUrl);
  }
  if ((maplibregl as any).config) {
    (maplibregl as any).config.WORKER_URL = workerUrl;
  }
}

export interface CheckpointItem {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  sequence: number;
  isRequired?: boolean;
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

export interface SystemTrailDetail {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  difficulty?: string;
  distanceKm: number;
  elevationGainM?: number | null;
  estimatedDurationMinutes?: number | null;
  destination: {
    id?: string;
    name: string;
    region?: string | null;
    centerLat?: number | null;
    centerLng?: number | null;
  };
  checkpointCount?: number;
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

export interface StepTwoOverviewMapProps {
  trailCode?: string;
  onTrailLoaded?: (trail: SystemTrailDetail) => void;
}

export function StepTwoOverviewMap({
  trailCode,
  onTrailLoaded,
}: StepTwoOverviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [trail, setTrail] = useState<SystemTrailDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(true);

  // 1. Gọi API Backend lấy toạ độ GeoJSON & Checkpoints khi có trailCode
  useEffect(() => {
    let cancelled = false;
    const code = trailCode;

    if (!code) {
      setTrail(null);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchTrailData(trailId: string) {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get<SystemTrailDetail>(
          `/api/v1/system-trails/${encodeURIComponent(trailId)}`
        );
        if (!cancelled) {
          setTrail(res.data);
          if (onTrailLoaded) {
            onTrailLoaded(res.data);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Lỗi khi tải toạ độ cung đường:", err);
          setError("Không thể tải bản đồ từ máy chủ.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTrailData(code);
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
      center,
      zoom: trail.initialCamera?.zoom || 14.2,
      pitch: is3D ? trail.initialCamera?.pitch || 60 : 0,
      bearing: is3D ? trail.initialCamera?.bearing || 15 : 0,
      maxPitch: 85,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right"
    );

    map.on("load", () => {
      // A. Thêm nguồn DEM địa hình 3D (nếu ở chế độ 3D)
      if (is3D) {
        map.addSource("mapter-dem", {
          type: "raster-dem",
          tiles: [
            "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          encoding: "terrarium",
          maxzoom: 15,
        });

        map.setTerrain({
          source: "mapter-dem",
          exaggeration: 1.5,
        });

        map.setSky({
          "sky-color": "#1976d2",
          "sky-horizon-blend": 0.5,
          "horizon-color": "#ffffff",
          "horizon-fog-blend": 0.5,
          "fog-color": "#f0f8ff",
          "fog-ground-blend": 0.5,
        });
      }

      // B. Vẽ LineString cung đường GPS GeoJSON
      if (trail.routeGeojson) {
        map.addSource("trail-route-source", {
          type: "geojson",
          data: trail.routeGeojson,
        });

        // Lớp glow viền ngoài
        map.addLayer({
          id: "trail-route-glow",
          type: "line",
          source: "trail-route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#ffffff",
            "line-width": 8,
            "line-opacity": 0.6,
          },
        });

        // Lớp line chính nổi bật
        map.addLayer({
          id: "trail-route-line",
          type: "line",
          source: "trail-route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#ea580c",
            "line-width": 5,
          },
        });
      }

      // C. Đánh dấu các mốc Checkpoint
      if (trail.checkpoints && trail.checkpoints.length > 0) {
        trail.checkpoints.forEach((cp, idx) => {
          const el = document.createElement("div");
          el.className =
            "grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-md ring-2 ring-white";
          el.innerText = `${idx + 1}`;

          const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <strong style="color: #064e3b; font-size: 13px;">${idx + 1}. ${cp.name}</strong>
              <p style="margin: 2px 0 0 0; color: #475569;">${cp.description || "Mốc kiểm soát an toàn"}</p>
            </div>
          `);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([Number(cp.longitude), Number(cp.latitude)])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });
      }

      // D. Tự động cân chỉnh camera
      if (trail.bounds) {
        map.fitBounds(
          [
            [trail.bounds.minLng, trail.bounds.minLat],
            [trail.bounds.maxLng, trail.bounds.maxLat],
          ],
          { padding: 30, duration: 1000 }
        );
      }
    });

    mapRef.current = map;

    // Resize map sau khi mount
    const resizeTimer = setTimeout(() => {
      map.resize();
    }, 200);

    return () => {
      clearTimeout(resizeTimer);
      markersRef.current.forEach((m) => m.remove());
      map.remove();
    };
  }, [trail, is3D]);

  if (!trailCode) {
    return (
      <div className="relative mt-4 flex h-52 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
        <span className="text-2xl mb-1">🗺️</span>
        <p className="text-xs font-semibold text-slate-700">Chưa chọn cung đường</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Vui lòng chọn một cung đường để xem bản đồ 3D GPS
        </p>
      </div>
    );
  }

  return (
    <div className="relative mt-4 h-52 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
      {/* Container gắn canvas bản đồ */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Loading State */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-slate-900/80 backdrop-blur-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <span className="text-[11px] font-medium text-white">
            Đang tải dữ liệu GPS 3D...
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
      <div className="absolute left-2.5 top-2.5 z-10 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-slate-950/80 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 backdrop-blur border border-slate-700">
          ● {trail?.name ? `${trail.name} - GPS 3D` : "GPS 3D Ready"}
        </span>
        <button
          type="button"
          onClick={() => setIs3D(!is3D)}
          className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-800 backdrop-blur hover:bg-white transition"
        >
          {is3D ? "3D" : "2D"}
        </button>
      </div>

      <span className="absolute bottom-2 left-2 z-10 rounded bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 backdrop-blur border border-slate-700">
        MapLibre 3D Terrain
      </span>
    </div>
  );
}

export default StepTwoOverviewMap;

