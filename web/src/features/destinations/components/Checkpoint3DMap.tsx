"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import { Destination } from "../types/destination.types";
import { Checkpoint } from "../types/checkpoint.types";
import { SystemTrailDetail } from "../types/system-trail.types";
import {
  BaseMap3D,
  BaseMap3DRef,
} from "@/features/core/components/map/BaseMap3D";
import {
  drawTrailPolyline,
  removeTrailPolyline,
  renderCheckpointMarkers,
  removeCheckpointTerrainLayers,
  fitBoundsAndLockMinZoom,
  runWhenMapStyleReady,
  TRAIL_PALETTE,
} from "@/features/core/components/map/map-utils";

interface Checkpoint3DMapProps {
  destination: Destination | null;
  trails: SystemTrailDetail[];
  checkpoints: Checkpoint[];
  isAddMode: boolean;
  onToggleAddMode: () => void;
  onMapClickToAdd: (coords: { latitude: number; longitude: number }) => void;
  onEditCheckpoint: (cp: Checkpoint) => void;
  onDeleteCheckpoint: (id: string, name: string) => void;
}

export const Checkpoint3DMap: React.FC<Checkpoint3DMapProps> = ({
  destination,
  trails,
  checkpoints,
  isAddMode,
  onToggleAddMode,
  onMapClickToAdd,
  onEditCheckpoint,
  onDeleteCheckpoint,
}) => {
  const baseMapRef = useRef<BaseMap3DRef | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const tempMarkerRef = useRef<maplibregl.Marker | null>(null);
  const renderedTrailIdsRef = useRef<string[]>([]);
  const hasInitialCenteredRef = useRef(false);

  // Giữ ref cho isAddMode để tránh stale closure khi gắn event listeners
  const isAddModeRef = useRef(isAddMode);
  useEffect(() => {
    isAddModeRef.current = isAddMode;
  }, [isAddMode]);

  const [mouseCoords, setMouseCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const centerLng = Number(destination?.centerLng) || 106.1712;
  const centerLat = Number(destination?.centerLat) || 11.3789;
  const pad = 0.35;
  const maxBounds: [[number, number], [number, number]] = [
    [centerLng - pad, centerLat - pad],
    [centerLng + pad, centerLat + pad],
  ];

  // Render các markers Checkpoint sử dụng hàm tiện ích dùng chung từ core/map-utils
  const renderMarkers = useCallback(
    (map: maplibregl.Map) => {
      if (!map || (map as any)._removed) return;
      markersRef.current.forEach((m) => m.remove());
      removeCheckpointTerrainLayers(map);
      markersRef.current = renderCheckpointMarkers(map, checkpoints, {
        onEdit: onEditCheckpoint,
        onDelete: onDeleteCheckpoint,
      });
    },
    [checkpoints, onEditCheckpoint, onDeleteCheckpoint],
  );

  // Xử lý Click trên bản đồ (Click-To-Add)
  const handleMapClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!isAddModeRef.current) return;

      const { lng, lat } = e.lngLat;
      const map = mapInstanceRef.current;
      if (!map) return;

      if (tempMarkerRef.current) tempMarkerRef.current.remove();

      const pinEl = document.createElement("div");
      pinEl.innerHTML = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 32px;
          height: 32px;
          background: rgba(16, 185, 129, 0.4);
          border-radius: 50%;
          animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          width: 16px;
          height: 16px;
          background: #10B981;
          border: 3px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        "></div>
      </div>
    `;

      tempMarkerRef.current = new maplibregl.Marker({
        element: pinEl,
        anchor: "center",
        pitchAlignment: "viewport",
        rotationAlignment: "viewport",
        opacityWhenCovered: 1,
      })
        .setLngLat([lng, lat])
        .addTo(map);

      onMapClickToAdd({ latitude: lat, longitude: lng });
    },
    [onMapClickToAdd],
  );

  // Căn giữa toàn cảnh và khóa mức zoom out tối đa (minZoom) theo mốc camera này
  const centerMapAndLockMinZoom = useCallback(
    (map: maplibregl.Map) => {
      if (!map || (map as any)._removed) return;

      let minLng = Infinity,
        minLat = Infinity,
        maxLng = -Infinity,
        maxLat = -Infinity;
      let hasBounds = false;

      trails.forEach((trail) => {
        if (trail.bounds) {
          hasBounds = true;
          if (trail.bounds.minLng < minLng) minLng = trail.bounds.minLng;
          if (trail.bounds.minLat < minLat) minLat = trail.bounds.minLat;
          if (trail.bounds.maxLng > maxLng) maxLng = trail.bounds.maxLng;
          if (trail.bounds.maxLat > maxLat) maxLat = trail.bounds.maxLat;
        } else if (trail.routeGeojson) {
          const coords: [number, number][] =
            trail.routeGeojson.type === "Feature"
              ? trail.routeGeojson.geometry?.coordinates
              : trail.routeGeojson.coordinates;
          if (Array.isArray(coords)) {
            coords.forEach(([lng, lat]) => {
              if (typeof lng === "number" && typeof lat === "number") {
                hasBounds = true;
                if (lng < minLng) minLng = lng;
                if (lat < minLat) minLat = lat;
                if (lng > maxLng) maxLng = lng;
                if (lat > maxLat) maxLat = lat;
              }
            });
          }
        }
      });

      const bounds: [[number, number], [number, number]] | null =
        hasBounds && minLng !== Infinity && maxLng > minLng && maxLat > minLat
          ? [
              [minLng, minLat],
              [maxLng, maxLat],
            ]
          : null;

      fitBoundsAndLockMinZoom(map, bounds, [centerLng, centerLat]);
    },
    [trails, centerLng, centerLat],
  );

  // Reset cờ căn giữa và tự động căn mốc camera khi đổi địa danh
  useEffect(() => {
    hasInitialCenteredRef.current = false;
    const map = mapInstanceRef.current;
    if (map && !(map as any)._removed) {
      centerMapAndLockMinZoom(map);
    }
  }, [destination?.id, centerMapAndLockMinZoom]);

  // Vẽ các cung đường (trails) lên bản đồ khi có dữ liệu
  const renderTrails = useCallback(
    (map: maplibregl.Map) => {
      if (!map || (map as any)._removed || !map.isStyleLoaded()) return;

      // Xóa các layers/sources của trails cũ trước khi vẽ danh sách mới
      renderedTrailIdsRef.current.forEach((id) => {
        removeTrailPolyline(map, id);
      });
      renderedTrailIdsRef.current = [];

      trails.forEach((trail, idx) => {
        const color = TRAIL_PALETTE[idx % TRAIL_PALETTE.length];
        drawTrailPolyline(map, {
          id: trail.id,
          geojson: trail.routeGeojson,
          strokeColor: color.stroke,
          name: trail.name,
          distanceKm: trail.distanceKm,
          elevationGainM: trail.elevationGainM ?? undefined,
          onLineClick: (e) => {
            if (isAddModeRef.current) {
              handleMapClick(e);
            }
          },
        });
        renderedTrailIdsRef.current.push(trail.id);
      });

      // Chỉ tự động căn giữa đúng 1 lần duy nhất lúc tải xong cung đường ban đầu
      if (!hasInitialCenteredRef.current && trails.length > 0) {
        hasInitialCenteredRef.current = true;
        centerMapAndLockMinZoom(map);
      }
    },
    [trails, handleMapClick, centerMapAndLockMinZoom],
  );

  // Khi bản đồ BaseMap3D sẵn sàng
  const handleMapReady = useCallback(
    (map: maplibregl.Map) => {
      mapInstanceRef.current = map;
      if (map.isStyleLoaded()) {
        renderTrails(map);
      } else {
        runWhenMapStyleReady(map, () => renderTrails(map));
      }
      renderMarkers(map);
    },
    [renderTrails, renderMarkers],
  );

  // Cập nhật trails khi state trails tải về thành công từ API
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || (map as any)._removed) return;

    if (map.isStyleLoaded()) {
      renderTrails(map);
    } else {
      runWhenMapStyleReady(map, () => renderTrails(map));
    }
  }, [renderTrails]);

  // Cập nhật checkpoints khi state checkpoints thay đổi (Render trực tiếp ngay lập tức, không phụ thuộc WebGL style)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || (map as any)._removed) return;

    renderMarkers(map);
  }, [renderMarkers]);

  // Dọn dẹp pin tạm thời khi tắt chế độ AddMode
  useEffect(() => {
    if (!isAddMode && tempMarkerRef.current) {
      tempMarkerRef.current.remove();
      tempMarkerRef.current = null;
    }
  }, [isAddMode]);

  return (
    <BaseMap3D
      ref={baseMapRef}
      center={[centerLng, centerLat]}
      maxBounds={maxBounds}
      cursor={isAddMode ? "crosshair" : undefined}
      onMapReady={handleMapReady}
      onMapClick={handleMapClick}
      onMouseMove={(e) =>
        setMouseCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      }
      onMouseLeave={() => setMouseCoords(null)}
      className="relative w-full h-[580px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-slate-950"
    >
      {/* Thông tin tiêu đề & nút thao tác overlay trực tiếp trên bản đồ */}
      <div className="absolute top-4 left-4 right-14 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto">
          <h3 className="font-extrabold text-base tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
            {destination?.name || "Bản đồ Địa danh"}
          </h3>
          <p className="text-xs text-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] mt-0.5">
            Đang hiển thị <b>{trails.length}</b> cung đường •{" "}
            <b>{checkpoints.length}</b> trạm kiểm soát GPS
          </p>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Nút Thêm trạm */}
          <button
            onClick={onToggleAddMode}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-md ${
              isAddMode
                ? "bg-amber-500 text-slate-950 ring-2 ring-amber-300 animate-pulse"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
            title="Bấm vào để kích hoạt chế độ click đặt trạm trực tiếp trên bản đồ"
          >
            {isAddMode
              ? "Đang bật: Nhấp map để đặt trạm"
              : "+ Click trên Map để thêm trạm"}
          </button>

          {/* Căn giữa */}
          <button
            onClick={() => {
              const map = mapInstanceRef.current;
              if (!map) return;
              centerMapAndLockMinZoom(map);
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/60 transition cursor-pointer shadow-md"
            title="Căn giữa toàn cảnh địa danh và khóa mức zoom out tối đa"
          >
            Căn giữa
          </button>
        </div>
      </div>

      {/* Dải thông báo nổi khi đang ở chế độ Click-To-Add */}
      {isAddMode && (
        <div className="absolute top-16 left-4 z-10 bg-amber-500 text-slate-950 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-lg flex items-center gap-3 animate-fadeIn pointer-events-auto">
          <span>Chế độ đặt trạm</span>
          <button
            onClick={onToggleAddMode}
            className="text-slate-950 hover:text-white font-bold underline cursor-pointer ml-1"
          >
            Hủy thao tác
          </button>
        </div>
      )}

      {/* Tọa độ GPS con trỏ chuột theo thời gian thực ở góc dưới phải */}
      {mouseCoords && (
        <div className="absolute bottom-4 right-14 z-10 bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-slate-300 font-mono text-[10px] px-2.5 py-1 rounded-md shadow-md pointer-events-none">
          Lat: {mouseCoords.lat.toFixed(5)} • Lng: {mouseCoords.lng.toFixed(5)}
        </div>
      )}
    </BaseMap3D>
  );
};
