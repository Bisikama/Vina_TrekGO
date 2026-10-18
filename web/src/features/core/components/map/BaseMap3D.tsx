"use client";

import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getDemTileUrl, getSatelliteStyle } from "./map-config";

export interface BaseMap3DRef {
  getMap: () => maplibregl.Map | null;
  resetCamera: (center?: [number, number], zoom?: number) => void;
}

export interface BaseMap3DProps {
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  minZoom?: number;
  maxZoom?: number;
  maxBounds?: [[number, number], [number, number]];
  is3D?: boolean;
  terrainExaggeration?: number;
  cursor?: string;
  className?: string;
  onMapReady?: (map: maplibregl.Map) => void;
  onMapClick?: (e: maplibregl.MapMouseEvent) => void;
  onMouseMove?: (e: maplibregl.MapMouseEvent) => void;
  onMouseLeave?: () => void;
  children?: React.ReactNode;
}

export const BaseMap3D = forwardRef<BaseMap3DRef, BaseMap3DProps>(
  (
    {
      center = [106.1712, 11.3789],
      zoom = 13.5,
      pitch = 65,
      bearing = -20,
      minZoom = 9.0,
      maxZoom = 16.5,
      maxBounds,
      is3D = true,
      terrainExaggeration = 2.0,
      cursor,
      className = "relative w-full h-[580px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-slate-950",
      onMapReady,
      onMapClick,
      onMouseMove,
      onMouseLeave,
      children,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    // Cho phép cha gọi trực tiếp qua ref
    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
      resetCamera: (targetCenter = center, targetZoom = zoom) => {
        if (!mapRef.current) return;
        mapRef.current.flyTo({
          center: targetCenter,
          zoom: targetZoom,
          pitch: is3D ? pitch : 0,
          bearing: is3D ? bearing : 0,
          duration: 1000,
        });
      },
    }));

    const onMapClickRef = useRef(onMapClick);
    const onMouseMoveRef = useRef(onMouseMove);
    const onMouseLeaveRef = useRef(onMouseLeave);
    const onMapReadyRef = useRef(onMapReady);

    useEffect(() => {
      onMapClickRef.current = onMapClick;
      onMouseMoveRef.current = onMouseMove;
      onMouseLeaveRef.current = onMouseLeave;
      onMapReadyRef.current = onMapReady;
    }, [onMapClick, onMouseMove, onMouseLeave, onMapReady]);

    useEffect(() => {
      if (!containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: getSatelliteStyle(),
        center,
        zoom,
        pitch: is3D ? pitch : 0,
        bearing: is3D ? bearing : 0,
        minZoom,
        maxZoom,
        maxBounds,
        renderWorldCopies: false,
        maxPitch: 85,
        centerClampedToGround: false, // Tắt tự bám tâm camera xuống đất làm nhảy zoom khi rê chuột qua vùng trũng
      });

      if (typeof (map as any).setCenterClampedToGround === "function") {
        (map as any).setCenterClampedToGround(false);
      }

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "top-right",
      );
      map.addControl(new maplibregl.FullscreenControl(), "top-right");

      const setupTerrain = () => {
        try {
          if (!map || (map as any)._removed) return;

          if (!map.getSource("terrain-dem-source")) {
            map.addSource("terrain-dem-source", {
              type: "raster-dem",
              tiles: [getDemTileUrl()],
              encoding: "terrarium",
              tileSize: 256,
              minzoom: 5,
              maxzoom: 15,
            });
          }

          if (is3D) {
            map.setTerrain({
              source: "terrain-dem-source",
              exaggeration: terrainExaggeration,
            });
            if (typeof (map as any).setCenterClampedToGround === "function") {
              (map as any).setCenterClampedToGround(false);
            }
          }

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

          onMapReadyRef.current?.(map);
        } catch (err) {
          console.error("Lỗi khởi tạo terrain Map 3D:", err);
        }
      };

      if (map.isStyleLoaded()) {
        setupTerrain();
      } else {
        map.once("load", setupTerrain);
      }

      // Gắn sự kiện click (sử dụng callback ref để không bị stale closure khi bật isAddMode)
      map.on("click", (e) => {
        onMapClickRef.current?.(e);
      });

      // Gắn sự kiện di chuột
      map.on("mousemove", (e) => {
        onMouseMoveRef.current?.(e);
      });

      const canvas = map.getCanvas();
      const handleMouseLeave = () => {
        onMouseLeaveRef.current?.();
      };
      canvas.addEventListener("mouseleave", handleMouseLeave);

      mapRef.current = map;

      return () => {
        canvas.removeEventListener("mouseleave", handleMouseLeave);
        map.remove();
        mapRef.current = null;
      };
    }, [
      center[0],
      center[1],
      is3D,
      maxBounds?.[0]?.[0],
      maxBounds?.[1]?.[0],
    ]);

    // Cập nhật con trỏ chuột (ví dụ crosshair khi ở chế độ click-to-add)
    useEffect(() => {
      if (mapRef.current) {
        mapRef.current.getCanvas().style.cursor = cursor || "";
      }
    }, [cursor]);

    return (
      <div className={className}>
        <div ref={containerRef} className="w-full h-full" />
        {children}
      </div>
    );
  },
);

BaseMap3D.displayName = "BaseMap3D";
