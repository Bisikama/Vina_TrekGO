"use client";

import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Cấu hình Web Worker
if (typeof window !== "undefined") {
  const workerUrl = "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs";
  if (typeof (maplibregl as any).setWorkerUrl === "function") {
    (maplibregl as any).setWorkerUrl(workerUrl);
  }
  if ((maplibregl as any).config) {
    (maplibregl as any).config.WORKER_URL = workerUrl;
  }
}

export function PrivateTripMap({ geojson, checkpoints }: { geojson: any, checkpoints: any[] }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
    }
    
    // Tìm center mặc định từ tọa độ đầu tiên của geojson
    let center: [number, number] = [106.1712, 11.3789];
    if (geojson?.features?.[0]?.geometry?.coordinates?.[0]) {
      const firstCoord = geojson.features[0].geometry.coordinates[0];
      center = [firstCoord[0], firstCoord[1]];
    } else if (checkpoints?.length > 0) {
      center = [parseFloat(checkpoints[0].longitude), parseFloat(checkpoints[0].latitude)];
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "satellite-tiles": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
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
      },
      center: center,
      zoom: 13.5,
      pitch: 65,
      bearing: -20,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      // Thêm 3D Terrain
      map.addSource("terrain-dem-source", {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
      });
      map.setTerrain({ source: "terrain-dem-source", exaggeration: 1.5 });

      // Vẽ Geojson cung đường
      if (geojson) {
        map.addSource("trail-route", {
          type: "geojson",
          data: geojson,
        });

        // Đổ bóng
        map.addLayer({
          id: "trail-route-shadow",
          type: "line",
          source: "trail-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#000000",
            "line-width": 10,
            "line-opacity": 0.5,
          },
        });

        // Đường chính
        map.addLayer({
          id: "trail-route-main",
          type: "line",
          source: "trail-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#FF3D00",
            "line-width": 6,
          },
        });
      }

      // Vẽ Checkpoints
      if (checkpoints && checkpoints.length > 0) {
        checkpoints.forEach((cp, index) => {
          const el = document.createElement("div");
          el.className = "flex items-center justify-center font-bold text-white shadow-lg";
          el.style.width = "30px";
          el.style.height = "30px";
          el.style.borderRadius = "50%";
          el.style.backgroundColor = index === 0 ? "#10b981" : (index === checkpoints.length - 1 ? "#ef4444" : "#f59e0b");
          el.style.border = "3px solid white";
          el.innerText = cp.sequence.toString();

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([parseFloat(cp.longitude), parseFloat(cp.latitude)])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setHTML(
                `<div class="p-2 min-w-[150px]">
                  <h4 class="font-bold text-gray-900">${cp.name}</h4>
                  ${cp.description ? `<p class="text-xs text-gray-600 mt-1">${cp.description}</p>` : ''}
                </div>`
              )
            )
            .addTo(map);

          markersRef.current.push(marker);
        });
      }

      setIsMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
    };
  }, [geojson, checkpoints]);

  return (
    <div className="relative w-full h-full min-h-[500px] bg-gray-200 rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
      {!isMapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 z-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#125238]"></div>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <span className="px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-bold rounded-full border border-white/20 shadow-lg">
          3D MapLibre
        </span>
      </div>
    </div>
  );
}
