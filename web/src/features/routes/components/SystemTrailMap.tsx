"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SystemTrail } from "../services/system-trails.api";

// Config MapLibre Web Worker
if (typeof window !== "undefined") {
  const workerUrl = "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl-worker.mjs";
  if (typeof (maplibregl as any).setWorkerUrl === "function") {
    (maplibregl as any).setWorkerUrl(workerUrl);
  }
  if ((maplibregl as any).config) {
    (maplibregl as any).config.WORKER_URL = workerUrl;
  }
}

export function SystemTrailMap({ trail }: { trail: SystemTrail }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  
  const [is3D, setIs3D] = useState<boolean>(true);

  useEffect(() => {
    if (!mapContainerRef.current || !trail.routeGeojson) return;

    if (mapRef.current) {
      mapRef.current.remove();
    }
    
    const center: [number, number] = trail.initialCamera?.center || [106.1712, 11.3789];

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
      zoom: trail.initialCamera?.zoom || 13.5,
      pitch: is3D ? (trail.initialCamera?.pitch || 65) : 0,
      bearing: trail.initialCamera?.bearing || -20,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    map.on("load", () => {
      // Add 3D Terrain
      if (is3D && !map.getSource("terrain-dem-source")) {
        map.addSource("terrain-dem-source", {
          type: "raster-dem",
          tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 15,
        });
        map.setTerrain({ source: "terrain-dem-source", exaggeration: 2.0 });
      }

      // Add Trail GeoJSON
      if (trail.routeGeojson) {
        map.addSource("trail-route", {
          type: "geojson",
          data: trail.routeGeojson,
        });

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

        map.addLayer({
          id: "trail-route-main",
          type: "line",
          source: "trail-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#1B5E41",
            "line-width": 5,
            "line-opacity": 1.0,
          },
        });
      }

      // Add Checkpoints
      if (trail.checkpoints) {
        trail.checkpoints.forEach((cp, idx) => {
          const el = document.createElement("div");
          el.innerHTML = `
            <div class="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-[#1B5E41] text-white text-xs font-bold shadow-lg">
              ${cp.sequence || idx + 1}
            </div>
            <div class="text-xs font-bold text-white bg-black/50 px-1 rounded mt-1 shadow-sm whitespace-nowrap">
              ${cp.name}
            </div>
          `;
          
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([cp.longitude, cp.latitude])
            .addTo(map);
            
          markersRef.current.push(marker);
        });
      }

      // Fit bounds
      if (trail.bounds) {
        map.fitBounds(
          [
            [trail.bounds.minLng, trail.bounds.minLat],
            [trail.bounds.maxLng, trail.bounds.maxLat],
          ],
          { padding: 80, duration: 1000 }
        );
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, [trail, is3D]);

  return (
    <div className="relative w-full h-[500px] rounded-2xl overflow-hidden border border-gray-200 shadow-md">
      {!trail.routeGeojson && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm">
          <div className="text-center p-6 bg-white rounded-xl shadow-lg border border-gray-200">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Bản đồ đang bị khóa</h3>
            <p className="text-sm text-gray-500">Mở khóa cung đường để xem bản đồ 3D MapLibre và toàn bộ dữ liệu GPS.</p>
          </div>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full bg-slate-900" />
      
      {trail.routeGeojson && (
        <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur p-2 rounded-lg shadow-sm border border-gray-200 flex items-center gap-2">
          <button 
            onClick={() => setIs3D(true)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${is3D ? 'bg-[#1B5E41] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            3D Terrain
          </button>
          <button 
            onClick={() => setIs3D(false)}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${!is3D ? 'bg-[#1B5E41] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            2D Map
          </button>
        </div>
      )}
    </div>
  );
}
