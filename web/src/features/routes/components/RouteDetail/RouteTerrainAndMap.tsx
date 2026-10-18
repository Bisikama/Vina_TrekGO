"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { apiClient } from "@/lib/axios";
import { RouteData } from "../../data/mockRoutesData";

// Cấu hình URL Web Worker cho MapLibre GL v6 trong môi trường Next.js / Turbopack
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
  code?: string | null;
  name: string;
  description?: string | null;
  sequence: number;
  isRequired: boolean;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface SystemTrailDetailResponse {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  difficulty: string;
  distanceKm: number;
  elevationGainM?: number | null;
  estimatedDurationMinutes?: number | null;
  destination: {
    id: string;
    name: string;
    region?: string | null;
    centerLat?: number | null;
    centerLng?: number | null;
  };
  checkpointCount: number;
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

interface SystemTrailSummary {
  id: string;
  code: string;
  name: string;
  difficulty: string;
  distanceKm: number;
  destination: {
    name: string;
  };
}

type MapMode = "satellite" | "topo";

export const RouteTerrainAndMap = ({ route }: { route: RouteData }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const animFrameRef = useRef<number | null>(null);

  const [availableTrails, setAvailableTrails] = useState<SystemTrailSummary[]>([]);
  const [selectedTrailCode, setSelectedTrailCode] = useState<string>("TRAIL_BADEN_COTDIEN");
  const [trailData, setTrailData] = useState<SystemTrailDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [is3D, setIs3D] = useState<boolean>(true);
  const [mapMode, setMapMode] = useState<MapMode>("satellite");
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);
  const [terrainExaggeration, setTerrainExaggeration] = useState<number>(2.0);

  const getDemTileUrl = useCallback(
    () => "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
    [],
  );

  // 1. Fetch danh sách cung đường từ API Backend
  useEffect(() => {
    async function fetchTrailList() {
      try {
        const res = await apiClient.get<SystemTrailSummary[]>("/api/v1/system-trails");
        if (res.data && res.data.length > 0) {
          setAvailableTrails(res.data);
          const match = res.data.find(
            (t) =>
              t.code.toLowerCase() === route.id.toLowerCase() ||
              t.id === route.id ||
              (route.id.includes("ba-den") && t.code.includes("BADEN")) ||
              t.name.toLowerCase().includes("bà đen")
          );
          if (match) {
            setSelectedTrailCode(match.code);
          } else {
            // Ưu tiên trail Bà Đen nếu không tìm thấy match chính xác
            const baDenTrail = res.data.find((t) => t.code.includes("BADEN"));
            setSelectedTrailCode(baDenTrail ? baDenTrail.code : res.data[0].code);
          }
        }
      } catch (err) {
        console.warn("Không thể tải danh sách trails từ backend:", err);
      }
    }
    fetchTrailList();
  }, [route.id]);

  // 2. Fetch chi tiết cung đường từ API Backend
  useEffect(() => {
    let isCancelled = false;

    async function fetchTrailDetail() {
      if (!selectedTrailCode) return;
      setLoading(true);
      setError(null);

      try {
        const res = await apiClient.get<SystemTrailDetailResponse>(
          `/api/v1/system-trails/${encodeURIComponent(selectedTrailCode)}`
        );
        if (!isCancelled) {
          setTrailData(res.data);
          setLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Lỗi khi tải dữ liệu chi tiết trail:", err);
          setError("Không thể tải dữ liệu GPS từ Backend.");
          setLoading(false);
        }
      }
    }

    fetchTrailDetail();

    return () => {
      isCancelled = true;
    };
  }, [selectedTrailCode]);

  // 3. Khởi tạo và thiết lập MapLibre 3D Terrain + Polyline + Markers
  useEffect(() => {
    if (!mapContainerRef.current || !trailData) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const center: [number, number] = trailData.initialCamera?.center || [
      trailData.destination.centerLng || 106.1712,
      trailData.destination.centerLat || 11.3789,
    ];

    // Giới hạn khu vực (maxBounds) quanh địa danh để khóa camera, tránh request tile thừa thãi
    const pad = 0.06;
    const maxBounds: [[number, number], [number, number]] | undefined = trailData.bounds
      ? [
          [trailData.bounds.minLng - pad, trailData.bounds.minLat - pad],
          [trailData.bounds.maxLng + pad, trailData.bounds.maxLat + pad],
        ]
      : center
      ? [
          [center[0] - 0.08, center[1] - 0.08],
          [center[0] + 0.08, center[1] + 0.08],
        ]
      : undefined;

    // Tạo style chuẩn hợp lệ cho MapLibre (không chứa thuộc tính lỗi)
    const isSat = mapMode === "satellite";
    const initialStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        "base-raster-tiles": {
          type: "raster",
          tiles: isSat
            ? [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              ]
            : [
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
          tileSize: 256,
          attribution: isSat ? "© Esri World Imagery" : "© OpenStreetMap contributors",
        },
      },
      layers: [
        {
          id: "base-raster-layer",
          type: "raster",
          source: "base-raster-tiles",
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: center,
      zoom: 13.5,
      minZoom: 11.5,
      maxZoom: 16,
      maxBounds: maxBounds,
      renderWorldCopies: false,
      pitch: is3D ? 65 : 0,
      bearing: -20,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    const setupLayersAndTerrain = () => {
      try {
        // A. Thêm nguồn DEM 3D Terrain (Ưu tiên local static tiles nếu có)
        if (!map.getSource("terrain-dem-source")) {
          map.addSource("terrain-dem-source", {
            type: "raster-dem",
            tiles: [getDemTileUrl()],
            encoding: "terrarium",
            tileSize: 256,
            minzoom: 11,
            maxzoom: 15,
          });
        }

        // B. Kích hoạt 3D Terrain Mesh nổi khối ngọn núi
        if (is3D) {
          map.setTerrain({
            source: "terrain-dem-source",
            exaggeration: terrainExaggeration, // Nhân hệ số để núi Bà Đen nhô cao rõ nét
          });
        } else {
          map.setTerrain(null);
        }

        // C. Thêm lớp đổ bóng Hillshade sườn núi tự nhiên
        if (!map.getLayer("hillshading-3d-layer")) {
          map.addLayer({
            id: "hillshading-3d-layer",
            type: "hillshade",
            source: "terrain-dem-source",
            paint: {
              "hillshade-exaggeration": 0.7,
              "hillshade-shadow-color": "#0B1120",
              "hillshade-highlight-color": "#FFFFFF",
            },
          });
        }

        // D. Thêm GeoJSON Polyline của Cung đường
        if (trailData.routeGeojson) {
          if (map.getSource("trail-route-source")) {
            (map.getSource("trail-route-source") as maplibregl.GeoJSONSource).setData(
              trailData.routeGeojson
            );
          } else {
            map.addSource("trail-route-source", {
              type: "geojson",
              data: trailData.routeGeojson,
            });
          }

          // Lớp 1: Bóng đổ chiều sâu màu đen mờ
          if (!map.getLayer("trail-route-shadow")) {
            map.addLayer({
              id: "trail-route-shadow",
              type: "line",
              source: "trail-route-source",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#000000",
                "line-width": 12,
                "line-opacity": 0.5,
                "line-blur": 3,
              },
            });
          }

          // Lớp 2: Viền Casing màu trắng phát sáng
          if (!map.getLayer("trail-route-casing")) {
            map.addLayer({
              id: "trail-route-casing",
              type: "line",
              source: "trail-route-source",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#FFFFFF",
                "line-width": 8,
                "line-opacity": 0.95,
              },
            });
          }

          // Lớp 3: Đường chính màu Đỏ Cam Neon siêu nổi bật
          if (!map.getLayer("trail-route-main")) {
            map.addLayer({
              id: "trail-route-main",
              type: "line",
              source: "trail-route-source",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#FF2A00",
                "line-width": 5,
                "line-opacity": 1.0,
              },
            });
          }

          // Lớp 4: Vệt đứt đoạn vàng chỉ hướng di chuyển
          if (!map.getLayer("trail-route-arrow-dash")) {
            map.addLayer({
              id: "trail-route-arrow-dash",
              type: "line",
              source: "trail-route-source",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#FFEA00",
                "line-width": 2.5,
                "line-dasharray": [2, 3],
              },
            });
          }
        }

        // E. Thêm Markers cho các Checkpoint
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        if (trailData.checkpoints && trailData.checkpoints.length > 0) {
          trailData.checkpoints.forEach((cp) => {
            const isStart = cp.sequence === 1;
            const isSummit = cp.sequence === trailData.checkpoints.length;

            const el = document.createElement("div");
            el.className = "cursor-pointer select-none flex flex-col items-center pointer-events-auto";
            el.style.zIndex = isSummit ? "3" : isStart ? "2" : "1";

            el.innerHTML = `
              <div style="
                background: ${isStart ? "#059669" : isSummit ? "#DC2626" : "#2563EB"};
                color: #FFFFFF;
                padding: 4px 10px;
                border-radius: 9999px;
                font-size: 11px;
                font-weight: 800;
                white-space: nowrap;
                box-shadow: 0 4px 14px rgba(0,0,0,0.6);
                border: 2px solid #FFFFFF;
                margin-bottom: 2px;
                letter-spacing: 0.2px;
              ">
                ${isStart ? "🟢 Cột 1 (Xuất phát)" : isSummit ? "🚩 Đỉnh 986m" : `Trạm ${cp.sequence}`}
              </div>
              <div style="
                width: 14px;
                height: 14px;
                background: #FFFFFF;
                border: 3.5px solid ${isStart ? "#059669" : isSummit ? "#DC2626" : "#2563EB"};
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.5);
              "></div>
            `;

            const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(`
              <div style="padding: 6px; font-family: sans-serif; min-width: 160px;">
                <div style="font-size: 10px; font-weight: 800; color: ${isStart ? "#059669" : isSummit ? "#DC2626" : "#2563EB"}; text-transform: uppercase;">
                  ${isStart ? "Điểm xuất phát" : isSummit ? "Chóp đỉnh Núi Bà Đen" : `Trạm số ${cp.sequence}`}
                </div>
                <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin: 3px 0;">${cp.name}</div>
                ${cp.description ? `<div style="font-size: 11px; color: #475569;">${cp.description}</div>` : ""}
                <div style="font-size: 11px; color: #334155; margin-top: 5px; padding-top: 4px; border-top: 1px solid #E2E8F0;">
                  🎯 Vùng check-in: <b>${cp.radiusMeters}m</b>
                </div>
              </div>
            `);

            const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
              .setLngLat([cp.longitude, cp.latitude])
              .setPopup(popup)
              .addTo(map);

            markersRef.current.push(marker);
          });
        }

        // F. Căn góc nhìn Camera 3D bao quát cung đường
        if (trailData.bounds) {
          map.fitBounds(
            [
              [trailData.bounds.minLng, trailData.bounds.minLat],
              [trailData.bounds.maxLng, trailData.bounds.maxLat],
            ],
            {
              padding: { top: 90, bottom: 80, left: 80, right: 80 },
              duration: 800,
              pitch: is3D ? 65 : 0,
              bearing: is3D ? -20 : 0,
            }
          );
        }
      } catch (setupErr) {
        console.error("Lỗi khi nạp layers và 3D terrain:", setupErr);
      }
    };

    if (map.loaded()) {
      setupLayersAndTerrain();
    } else {
      map.on("load", setupLayersAndTerrain);
    }

    map.on("error", (e) => {
      console.warn("MapLibre cảnh báo/lỗi:", e.error);
    });

    mapRef.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [trailData, mapMode]);

  // Cập nhật độ nổi khối 3D hoặc chuyển đổi 2D/3D mà không khởi động lại bản đồ
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (is3D) {
        if (!map.getSource("terrain-dem-source")) {
          map.addSource("terrain-dem-source", {
            type: "raster-dem",
            tiles: [getDemTileUrl()],
            encoding: "terrarium",
            tileSize: 256,
            minzoom: 11,
            maxzoom: 15,
          });
        }
        map.setTerrain({
          source: "terrain-dem-source",
          exaggeration: terrainExaggeration,
        });
        map.easeTo({ pitch: 65, bearing: -20, duration: 800 });
      } else {
        map.setTerrain(null);
        map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
      }
    } catch (e) {
      console.warn("Lỗi khi cập nhật terrain:", e);
    }
  }, [is3D, terrainExaggeration]);

  // Nút chuyển đổi góc 2D / 3D
  const toggle3D = () => {
    setIs3D((prev) => !prev);
  };

  // Nút xoay 360 độ quanh ngọn núi (Orbit Camera)
  const toggleOrbit = () => {
    if (!mapRef.current) return;
    if (isOrbiting) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setIsOrbiting(false);
      return;
    }

    setIsOrbiting(true);
    let bearing = mapRef.current.getBearing();

    const rotateCamera = () => {
      if (!mapRef.current) return;
      bearing = (bearing + 0.3) % 360;
      mapRef.current.setBearing(bearing);
      animFrameRef.current = requestAnimationFrame(rotateCamera);
    };

    rotateCamera();
  };

  // Căn giữa toàn bộ cung đường
  const handleResetCamera = () => {
    if (!mapRef.current || !trailData?.bounds) return;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      setIsOrbiting(false);
    }
    mapRef.current.fitBounds(
      [
        [trailData.bounds.minLng, trailData.bounds.minLat],
        [trailData.bounds.maxLng, trailData.bounds.maxLat],
      ],
      { padding: 70, duration: 1200 }
    );
    if (is3D) {
      setTimeout(() => {
        mapRef.current?.easeTo({ pitch: 65, bearing: -20, duration: 800 });
      }, 500);
    }
  };

  return (
    <div className="space-y-6">
      {/* 3D Map View Container */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative isolate">
        {/* Header điều khiển bản đồ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-lg font-extrabold text-gray-900">
                Bản đồ 3D Núi Bà Đen & GPS Tracklog
              </h2>
            </div>
            {trailData && (
              <p className="text-xs text-gray-500 mt-0.5">
                Cung đường: <span className="font-bold text-gray-800">{trailData.name}</span> ({trailData.distanceKm} km, dốc leo tích lũy +{trailData.elevationGainM}m)
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bộ chọn cung đường từ Backend */}
            {availableTrails.length > 0 && (
              <select
                aria-label="Chọn cung đường từ Backend"
                value={selectedTrailCode}
                onChange={(e) => setSelectedTrailCode(e.target.value)}
                className="text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {availableTrails.map((t) => (
                  <option key={t.code} value={t.code}>
                    📍 {t.name}
                  </option>
                ))}
              </select>
            )}

            {/* Chuyển chế độ Vệ tinh 3D / Bản đồ Topo */}
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200">
              <button
                onClick={() => setMapMode("satellite")}
                className={`text-xs font-bold px-2.5 py-1 rounded-md transition-all ${
                  mapMode === "satellite"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                🛰️ Vệ tinh
              </button>
              <button
                onClick={() => setMapMode("topo")}
                className={`text-xs font-bold px-2.5 py-1 rounded-md transition-all ${
                  mapMode === "topo"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                🗺️ Bản đồ
              </button>
            </div>

            {/* Nút bật/tắt 3D */}
            <button
              onClick={toggle3D}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors border ${
                is3D
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
              }`}
            >
              {is3D ? "⛰️ 3D Nghiêng (65°)" : "2D Nhìn thẳng"}
            </button>

            {/* Độ cao 3D (Exaggeration) */}
            {is3D && (
              <button
                onClick={() => setTerrainExaggeration((prev) => (prev === 2.0 ? 2.5 : 2.0))}
                className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1.5 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
                title="Thay đổi độ dốc 3D của quả núi"
              >
                Độ cao: {terrainExaggeration}x
              </button>
            )}

            {/* Nút Xoay 360 quanh đỉnh núi */}
            <button
              onClick={toggleOrbit}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors border ${
                isOrbiting
                  ? "bg-indigo-600 text-white border-indigo-600 animate-pulse"
                  : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
              }`}
              title="Tự động xoay 360 độ ngắm toàn cảnh 3D ngọn núi"
            >
              {isOrbiting ? "⏹ Dừng xoay" : "🔄 Xoay 360°"}
            </button>

            {/* Nút Reset View */}
            <button
              onClick={handleResetCamera}
              className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
            >
              Căn giữa
            </button>
          </div>
        </div>

        {/* Khung bản đồ MapLibre */}
        <div
          className="relative h-[440px] sm:h-[520px] w-full rounded-2xl overflow-hidden bg-slate-900 border border-gray-200 shadow-inner isolate"
          style={{ contain: "paint", isolation: "isolate" }}
        >
          {/* Div mount MapLibre */}
          <div
            ref={mapContainerRef}
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{ contain: "paint" }}
          />

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2">
              <div className="w-9 h-9 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-white">Đang tải địa hình 3D Núi Bà Đen...</span>
            </div>
          )}

          {/* Error Banner nếu có */}
          {error && (
            <div className="absolute top-4 left-4 right-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2.5 rounded-lg shadow-sm z-20 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => setSelectedTrailCode("TRAIL_BADEN_COTDIEN")}
                className="underline font-bold ml-2 text-amber-950"
              >
                Tải lại Núi Bà Đen
              </button>
            </div>
          )}

          {/* Bảng chú giải nổi góc trái bản đồ */}
          {trailData && (
            <div className="absolute top-3 left-3 bg-slate-900/90 text-white backdrop-blur-md p-3.5 rounded-xl border border-slate-700 shadow-2xl max-w-[240px] z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
                  {is3D ? "Địa hình 3D Mesh" : "Bản đồ 2D"}
                </span>
                <span className="text-[10px] bg-red-500/20 text-red-300 font-bold px-1.5 py-0.5 rounded border border-red-500/30">
                  🚩 986m Peak
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1.5 bg-[#FF2A00] border border-white rounded-full inline-block" />
                  <span className="font-semibold text-slate-100">Đường mòn Cột Điện</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white" />
                  <span>Cột 1 - Chân núi (42m)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block border border-white" />
                  <span>Cột 55 - Trạm nghỉ (535m)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block border border-white" />
                  <span>Đỉnh Núi Bà Đen (986m)</span>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-700/80 flex justify-between text-[11px] text-slate-300">
                <span>Chiều dài: <b className="text-white">{trailData.distanceKm} km</b></span>
                <span>Dốc: <b className="text-emerald-400">+{trailData.elevationGainM}m</b></span>
              </div>
            </div>
          )}

          {/* Hướng dẫn thao tác góc dưới */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-[10px] text-white/90 px-2.5 py-1 rounded-md pointer-events-none hidden sm:block">
            💡 Giữ chuột phải (hoặc Ctrl + kéo chuột) để xoay nghiêng ngắm địa hình 3D
          </div>
        </div>
      </div>

      {/* Elevation Profile (Mặt cắt độ cao) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-extrabold text-gray-900 mb-4">Mặt cắt độ cao (Elevation Profile)</h2>
        <div className="relative h-[200px] w-full rounded-xl overflow-hidden bg-[#F8FAFC] border border-gray-100 p-4">
          <div className="absolute inset-0 opacity-80 mix-blend-multiply">
            <Image
              src={route.elevationProfileImage}
              alt="Mặt cắt độ cao"
              fill
              className="object-cover"
            />
          </div>

          <div className="relative z-10 flex justify-between h-full">
            <div className="flex flex-col justify-between">
              <div className="text-[10px] font-bold text-gray-700">
                {trailData ? `986m (Đỉnh)` : route.totalElevation}
              </div>
              <div className="text-[10px] font-bold text-gray-500">42m (Chân)</div>
            </div>
            <div className="flex items-end text-[10px] font-bold text-gray-500 pt-2 w-full justify-between ml-2 border-t border-dashed border-gray-300 self-end">
              <span>0 km</span>
              <span>2.2 km (Trạm 55)</span>
              <span>{trailData ? `${trailData.distanceKm} km` : route.totalDistance}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Độ dốc tích lũy</div>
            <div className="text-sm font-extrabold text-emerald-700">
              +{trailData?.elevationGainM || 944}m
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Chiều dài GPS</div>
            <div className="text-sm font-extrabold text-gray-900">
              {trailData?.distanceKm || 4.5} km
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-100">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Thời gian leo</div>
            <div className="text-sm font-extrabold text-gray-900">
              ~ 4 tiếng
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
