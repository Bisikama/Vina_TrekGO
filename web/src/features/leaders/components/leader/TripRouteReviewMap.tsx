"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiClient } from "@/lib/axios";
import type { CheckpointItem, SystemTrailDetail } from "./StepTwoOverviewMap";

// Đảm bảo MapLibre GL worker cấu hình chính xác
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

export function TripRouteReviewMap({
  trailCode,
  onTrailLoaded,
}: {
  trailCode?: string;
  onTrailLoaded?: (trail: SystemTrailDetail) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [trail, setTrail] = useState<SystemTrailDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(true);

  // 1. Gọi API Backend lấy toạ độ GeoJSON & Checkpoints
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
          `/api/v1/system-trails/${encodeURIComponent(trailId)}`,
        );
        if (!cancelled) {
          setTrail(res.data);
          onTrailLoaded?.(res.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Lỗi khi tải toạ độ cung đường:", err);
          setError("Không thể nạp dữ liệu GPS từ máy chủ");
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

  // 2. Render MapLibre khi có dữ liệu
  useEffect(() => {
    if (!mapContainerRef.current || !trail) return;

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
      zoom: trail.initialCamera?.zoom || 14.5,
      pitch: is3D ? trail.initialCamera?.pitch || 60 : 0,
      bearing: is3D ? trail.initialCamera?.bearing || 15 : 0,
      maxPitch: 85,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );

    map.on("load", () => {
      // A. DEM 3D Terrain
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

      // B. Tuyến đường GPS GeoJSON
      if (trail.routeGeojson) {
        map.addSource("trail-route-source", {
          type: "geojson",
          data: trail.routeGeojson,
        });

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

      // C. Checkpoints Markers
      if (trail.checkpoints && trail.checkpoints.length > 0) {
        trail.checkpoints.forEach((cp, idx) => {
          const el = document.createElement("div");
          el.className =
            "grid h-7 w-7 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-lg ring-2 ring-white";
          el.innerText = `${idx + 1}`;

          const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
            <div style="font-family: sans-serif; font-size: 13px; padding: 4px;">
              <strong style="color: #064e3b; font-size: 14px;">${idx + 1}. ${cp.name}</strong>
              <p style="margin: 3px 0 0 0; color: #475569; font-size: 12px;">${cp.description || "Trạm dừng an toàn"}</p>
            </div>
          `);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([Number(cp.longitude), Number(cp.latitude)])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });
      }

      // D. Cân chỉnh Camera
      if (trail.bounds) {
        map.fitBounds(
          [
            [trail.bounds.minLng, trail.bounds.minLat],
            [trail.bounds.maxLng, trail.bounds.maxLat],
          ],
          { padding: 40, duration: 1000 },
        );
      }
    });

    mapRef.current = map;

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
      <div className="relative mt-4 flex h-80 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <span className="text-3xl mb-2">🗺️</span>
        <p className="text-sm font-semibold text-slate-700">Chưa có cung đường được gán cho chuyến đi</p>
        <p className="text-xs text-slate-500 mt-1">
          Vui lòng quay lại Bước 2 để chọn cung đường
        </p>
      </div>
    );
  }

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
          ● {trail?.destination?.name ? `GPS 3D ${trail.destination.name}` : trail?.name ? `GPS 3D ${trail.name}` : "GPS 3D Ready"}
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
        {trail?.elevationGainM ? `Đỉnh ${trail.elevationGainM}m · ` : ""}Cự ly {trail?.distanceKm || 0}km
      </span>
    </div>
  );
}
