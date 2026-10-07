import * as maplibregl from "maplibre-gl";

export const TRAIL_PALETTE = [
  { stroke: "#FF3D00", glow: "#FF9E80", label: "Cam Neon" },
  { stroke: "#00E5FF", glow: "#84FFFF", label: "Xanh Cyan" },
  { stroke: "#00E676", glow: "#B9F6CA", label: "Xanh Lime" },
  { stroke: "#D500F9", glow: "#EA80FC", label: "Tím Magenta" },
  { stroke: "#FFD600", glow: "#FFFF8D", label: "Vàng Gold" },
];

export interface DrawTrailOptions {
  id: string;
  geojson: any;
  strokeColor?: string;
  name?: string;
  distanceKm?: number;
  elevationGainM?: number;
  onLineClick?: (e: maplibregl.MapMouseEvent) => void;
}

/**
 * Tiện ích vẽ tuyến đường trekking 3 lớp (bóng đổ + viền trắng + nét chính)
 */
export function drawTrailPolyline(map: maplibregl.Map, opts: DrawTrailOptions) {
  const {
    id,
    geojson,
    strokeColor = "#FF3D00",
    name,
    distanceKm,
    elevationGainM,
    onLineClick,
  } = opts;

  if (!geojson) return;

  let validGeoJson = geojson;
  if (typeof geojson === "string") {
    try {
      validGeoJson = JSON.parse(geojson);
    } catch {
      return;
    }
  }

  if (
    validGeoJson?.type === "LineString" ||
    validGeoJson?.type === "MultiLineString"
  ) {
    validGeoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: validGeoJson,
        },
      ],
    };
  }

  const sourceId = `trail-source-${id}`;
  const shadowLayerId = `trail-shadow-${id}`;
  const casingLayerId = `trail-casing-${id}`;
  const mainLayerId = `trail-main-${id}`;

  if (map.getSource(sourceId)) {
    (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(validGeoJson);
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data: validGeoJson,
    });
  }

  // 1. Lớp bóng đổ mờ
  if (!map.getLayer(shadowLayerId)) {
    map.addLayer({
      id: shadowLayerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#000000",
        "line-width": 10,
        "line-opacity": 0.5,
        "line-blur": 3,
      },
    });
  }

  // 2. Lớp viền casing trắng
  if (!map.getLayer(casingLayerId)) {
    map.addLayer({
      id: casingLayerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#FFFFFF",
        "line-width": 6,
        "line-opacity": 0.9,
      },
    });
  }

  // 3. Lớp nét chính
  if (!map.getLayer(mainLayerId)) {
    map.addLayer({
      id: mainLayerId,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": strokeColor,
        "line-width": 4,
      },
    });

    if (onLineClick) {
      map.on("click", mainLayerId, onLineClick);
    } else if (name) {
      map.on("click", mainLayerId, (e) => {
        new maplibregl.Popup({ offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(
            `
            <div style="font-family: sans-serif; padding: 6px;">
              <div style="font-size: 10px; font-weight: 800; color: ${strokeColor}; text-transform: uppercase;">
                Cung đường trekking
              </div>
              <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin: 2px 0;">
                ${name}
              </div>
              <div style="font-size: 11px; color: #475569; display: flex; gap: 8px; margin-top: 4px;">
                ${distanceKm !== undefined ? `<span>📏 <b>${distanceKm} km</b></span>` : ""}
                ${elevationGainM !== undefined ? `<span>📈 <b>+${elevationGainM}m</b></span>` : ""}
              </div>
            </div>
          `,
          )
          .addTo(map);
      });
    }

    map.on("mouseenter", mainLayerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", mainLayerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

/**
 * Đảm bảo callback được thực thi an toàn khi Map style đã nạp đầy đủ.
 * Không bị kẹt vĩnh viễn nếu sự kiện 'load' đã kích hoạt trước đó.
 */
export function runWhenMapStyleReady(map: maplibregl.Map, callback: () => void) {
  if (!map || (map as any)._removed) return;

  if (map.isStyleLoaded()) {
    callback();
    return;
  }

  let executed = false;
  const onReady = () => {
    if (executed || !map || (map as any)._removed) return;
    if (map.isStyleLoaded()) {
      executed = true;
      map.off("styledata", onReady);
      map.off("idle", onReady);
      map.off("load", onReady);
      callback();
    }
  };

  map.on("styledata", onReady);
  map.on("idle", onReady);
  map.once("load", onReady);
}

/**
 * Xóa sạch các layer và source của 1 trail polyline khỏi bản đồ
 */
export function removeTrailPolyline(map: maplibregl.Map, id: string) {
  if (!map || (map as any)._removed) return;
  // Bỏ qua nếu style chưa nạp xong để không gây lỗi Error: Style is not done loading
  if (!map.isStyleLoaded()) return;

  const mainLayerId = `trail-main-${id}`;
  const casingLayerId = `trail-casing-${id}`;
  const shadowLayerId = `trail-shadow-${id}`;
  const sourceId = `trail-source-${id}`;

  try {
    if (map.getLayer(mainLayerId)) map.removeLayer(mainLayerId);
    if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
    if (map.getLayer(shadowLayerId)) map.removeLayer(shadowLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch {}
}

export interface CheckpointMarkerData {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  latitude: number;
  longitude: number;
  defaultRadiusMeters?: number;
  checkpointType?: string | null;
}

export interface RenderCheckpointOptions<
  T extends CheckpointMarkerData = CheckpointMarkerData,
> {
  onEdit?: (cp: T) => void;
  onDelete?: (id: string, name: string) => void;
}

export function getCheckpointBadgeInfo(type?: string | null) {
  switch (type) {
    case "START":
      return { icon: "🏁", bg: "#059669", text: "Bắt đầu" };
    case "CAMPSITE":
      return { icon: "⛺", bg: "#D97706", text: "Lán trại" };
    case "SUMMIT":
      return { icon: "🏔️", bg: "#DC2626", text: "Đỉnh núi" };
    case "WATER_SOURCE":
      return { icon: "💧", bg: "#2563EB", text: "Nguồn nước" };
    case "VIEWPOINT":
      return { icon: "📸", bg: "#DB2777", text: "Điểm ngắm" };
    case "END":
      return { icon: "🏁", bg: "#991B1B", text: "Kết thúc" };
    default:
      return { icon: "📍", bg: "#4B5563", text: "Trạm mốc" };
  }
}

// Hiệu ứng làm mờ và mờ nhạt khi checkpoint bị núi/địa hình 3D che khuất
if (typeof document !== "undefined") {
  const styleId = "maplibre-marker-override-style";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.innerHTML = `
    .maplibregl-marker {
      transition: opacity 0.35s ease, filter 0.35s ease;
    }
    .maplibregl-marker.maplibregl-marker-covered {
      opacity: 0.25 !important;
      filter: blur(1.2px) grayscale(60%) !important;
      pointer-events: none !important;
    }
  `;
}

/**
 * Xóa sạch các WebGL layer của checkpoint khỏi bản đồ
 */
export function removeCheckpointTerrainLayers(map: maplibregl.Map) {
  if (!map || (map as any)._removed) return;
  // Bỏ qua nếu style chưa nạp xong để không gây lỗi Error: Style is not done loading
  if (!map.isStyleLoaded()) return;

  const pointLayerId = "checkpoints-webgl-point";
  const glowLayerId = "checkpoints-webgl-glow";
  const sourceId = "checkpoints-webgl-source";

  try {
    if (map.getLayer(pointLayerId)) map.removeLayer(pointLayerId);
    if (map.getLayer(glowLayerId)) map.removeLayer(glowLayerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch {}
}

/**
 * Tiện ích khởi tạo và hiển thị các Marker Checkpoint 3D chuẩn hóa lên bản đồ
 */
export function renderCheckpointMarkers<T extends CheckpointMarkerData>(
  map: maplibregl.Map,
  checkpoints: T[],
  options?: RenderCheckpointOptions<T>,
): maplibregl.Marker[] {
  const markers: maplibregl.Marker[] = [];
  if (!map || (map as any)._removed) return markers;

  // Dọn sạch mọi lớp tròn bám sát địa hình nếu có để chỉ hiển thị duy nhất 1 điểm marker nổi
  try {
    removeCheckpointTerrainLayers(map);
  } catch {}

  checkpoints.forEach((cp) => {
    const lat = Number(cp.latitude);
    const lng = Number(cp.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const el = document.createElement("div");
    el.className = "group cursor-pointer select-none";
    el.style.opacity = "1";
    el.style.visibility = "visible";
    el.style.zIndex = "20";

    const info = getCheckpointBadgeInfo(cp.checkpointType);

    el.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(0, -10px);">
        <div style="
          background: #0F172A;
          color: #FFFFFF;
          padding: 3px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 4px 14px rgba(0,0,0,0.6);
          border: 2px solid #FFFFFF;
          display: flex;
          align-items: center;
          gap: 4px;
          letter-spacing: 0.2px;
        ">
          <span>${info.icon}</span>
          <span>${cp.name}</span>
        </div>
        <div style="
          width: 12px;
          height: 12px;
          background: ${info.bg};
          border: 2.5px solid #FFFFFF;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.5);
          margin-top: 2px;
        "></div>
      </div>
    `;

    const popupContainer = document.createElement("div");
    popupContainer.style.padding = "6px";
    popupContainer.style.fontFamily = "sans-serif";
    popupContainer.style.minWidth = "180px";

    const hasActions = Boolean(options?.onEdit || options?.onDelete);

    popupContainer.innerHTML = `
      <div style="font-size: 10px; font-weight: 800; color: ${info.bg}; text-transform: uppercase;">
        ${info.icon} ${info.text} ${cp.code ? `• ${cp.code}` : ""}
      </div>
      <div style="font-size: 13px; font-weight: 800; color: #0F172A; margin: 3px 0;">${cp.name}</div>
      ${cp.description ? `<div style="font-size: 11px; color: #475569; margin-bottom: 4px;">${cp.description}</div>` : ""}
      <div style="font-size: 10px; font-family: monospace; color: #64748B; background: #F1F5F9; padding: 2px 5px; border-radius: 4px; margin-bottom: ${hasActions ? "6px" : "2px"};">
        📍 ${Number(cp.latitude).toFixed(5)}, ${Number(cp.longitude).toFixed(5)} (±${cp.defaultRadiusMeters || 50}m)
      </div>
      ${
        hasActions
          ? `
        <div style="display: flex; gap: 6px; padding-top: 6px; border-top: 1px solid #E2E8F0;">
          ${
            options?.onEdit
              ? `<button id="btn-edit-cp-${cp.id}" style="
                  flex: 1;
                  padding: 4px 8px;
                  background: #E0E7FF;
                  color: #3730A3;
                  border: none;
                  border-radius: 6px;
                  font-size: 11px;
                  font-weight: 700;
                  cursor: pointer;
                ">✏️ Sửa</button>`
              : ""
          }
          ${
            options?.onDelete
              ? `<button id="btn-del-cp-${cp.id}" style="
                  flex: 1;
                  padding: 4px 8px;
                  background: #FEE2E2;
                  color: #991B1B;
                  border: none;
                  border-radius: 6px;
                  font-size: 11px;
                  font-weight: 700;
                  cursor: pointer;
                ">🗑️ Xóa</button>`
              : ""
          }
        </div>
      `
          : ""
      }
    `;

    const popup = new maplibregl.Popup({
      offset: 18,
      closeButton: false,
    }).setDOMContent(popupContainer);

    if (hasActions) {
      popup.on("open", () => {
        if (options?.onEdit) {
          const btnEdit = popupContainer.querySelector(`#btn-edit-cp-${cp.id}`);
          btnEdit?.addEventListener("click", () => {
            popup.remove();
            options.onEdit?.(cp);
          });
        }
        if (options?.onDelete) {
          const btnDel = popupContainer.querySelector(`#btn-del-cp-${cp.id}`);
          btnDel?.addEventListener("click", () => {
            popup.remove();
            options.onDelete?.(cp.id, cp.name);
          });
        }
      });
    }

    const marker = new maplibregl.Marker({
      element: el,
      anchor: "bottom",
      pitchAlignment: "viewport",
      rotationAlignment: "viewport",
      opacityWhenCovered: 0.25, // Khi bị núi che khuất, làm mờ đi
    })
      .setLngLat([Number(cp.longitude), Number(cp.latitude)])
      .setPopup(popup)
      .addTo(map);

    markers.push(marker);
  });

  return markers;
}

export interface FitAndLockOptions {
  padding?: { top: number; bottom: number; left: number; right: number };
  pitch?: number;
  bearing?: number;
  duration?: number;
  defaultZoom?: number;
}

/**
 * Căn giữa bản đồ theo bounds (hoặc fallback center) và khóa chính xác mốc camera đó
 * làm giới hạn zoom out tối đa (minZoom).
 */
export function fitBoundsAndLockMinZoom(
  map: maplibregl.Map,
  bounds: [[number, number], [number, number]] | null,
  fallbackCenter?: [number, number],
  options: FitAndLockOptions = {},
) {
  if (!map || (map as any)._removed) return;

  const {
    padding = { top: 80, bottom: 70, left: 70, right: 70 },
    pitch = 65,
    bearing = -20,
    duration = 800,
    defaultZoom = 13.5,
  } = options;

  // Độ nới lỏng zoom out: giảm 2 level zoom = góc nhìn thu nhỏ x4 lần (2^2 = 4)
  const ZOOM_OUT_OFFSET = 2.0;

  if (
    bounds &&
    bounds[0][0] !== Infinity &&
    bounds[1][0] > bounds[0][0] &&
    bounds[1][1] > bounds[0][1]
  ) {
    const camera = map.cameraForBounds(bounds, {
      padding,
      bearing,
    });

    if (camera && typeof camera.zoom === "number") {
      const targetZoom = Number(camera.zoom.toFixed(2));
      // Cho phép zoom out ra xa gấp 4 lần so với mốc căn giữa
      const minZoomLimit = Math.max(7.0, Number((targetZoom - ZOOM_OUT_OFFSET).toFixed(2)));
      const currentZoom = map.getZoom();

      if (currentZoom < minZoomLimit) {
        map.setMinZoom(0);
        map.once("moveend", () => {
          if (!map || (map as any)._removed) return;
          map.setMinZoom(minZoomLimit);
        });
      } else {
        map.setMinZoom(minZoomLimit);
      }

      // Giữ nguyên 100% vị trí và góc nhìn căn giữa ban đầu
      map.easeTo({
        center: camera.center,
        zoom: targetZoom,
        pitch,
        bearing,
        duration,
      });
      return;
    }

    // Fallback fitBounds nếu cameraForBounds không khả dụng
    map.setMinZoom(0);
    map.fitBounds(bounds, {
      padding,
      duration,
      pitch,
      bearing,
    });
    map.once("moveend", () => {
      if (!map || (map as any)._removed) return;
      const finalZoom = Number(map.getZoom().toFixed(2));
      map.setMinZoom(Math.max(7.0, Number((finalZoom - ZOOM_OUT_OFFSET).toFixed(2))));
    });
  } else if (fallbackCenter) {
    // Nếu chưa có bounds hợp lệ, đưa camera về tâm địa danh và khóa default zoom
    const minZoomLimit = Math.max(7.0, Number((defaultZoom - ZOOM_OUT_OFFSET).toFixed(2)));
    const currentZoom = map.getZoom();
    if (currentZoom < minZoomLimit) {
      map.setMinZoom(0);
      map.once("moveend", () => {
        if (!map || (map as any)._removed) return;
        map.setMinZoom(minZoomLimit);
      });
    } else {
      map.setMinZoom(minZoomLimit);
    }

    // Giữ nguyên 100% mốc căn giữa fallback
    map.flyTo({
      center: fallbackCenter,
      zoom: defaultZoom,
      pitch,
      bearing,
      duration,
    });
  }
}
