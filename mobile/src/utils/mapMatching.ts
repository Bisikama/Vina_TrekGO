import { distanceMeters } from './gpsProcessor';

export interface SnappedLocation {
  latitude: number;
  longitude: number;
  elevation?: number;
  snapped: boolean;
  distanceToRouteM: number;
  segmentIndex: number;
  bearingDeg?: number;
}

/**
 * Thuật toán Map Matching (Snap to Route):
 * Chiếu vuông góc tọa độ GPS vào đoạn thẳng gần nhất của cung đường kế hoạch.
 * Nếu khoảng cách lệch <= maxDistanceM (mặc định 25m), snap vào tim đường.
 * Nếu khoảng cách > maxDistanceM, giữ nguyên tọa độ gốc (để phát hiện lệch tuyến).
 */
export function snapToRoute(
  point: { latitude: number; longitude: number; elevation?: number | null },
  route: [number, number][], // [longitude, latitude][]
  maxDistanceM = 25
): SnappedLocation {
  if (!route || route.length < 2) {
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      elevation: point.elevation ?? undefined,
      snapped: false,
      distanceToRouteM: 0,
      segmentIndex: -1,
    };
  }

  let minDistance = Infinity;
  let bestLat = point.latitude;
  let bestLng = point.longitude;
  let bestSegment = 0;
  let bestBearing = 0;

  const R = 6371000;
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  for (let i = 0; i < route.length - 1; i++) {
    const [lngA, latA] = route[i];
    const [lngB, latB] = route[i + 1];

    // Chiếu phẳng cục bộ tâm A
    const meanLat = ((latA + latB) / 2) * toRad;
    const cosMeanLat = Math.cos(meanLat);

    const bx = (lngB - lngA) * toRad * R * cosMeanLat;
    const by = (latB - latA) * toRad * R;

    const px = (point.longitude - lngA) * toRad * R * cosMeanLat;
    const py = (point.latitude - latA) * toRad * R;

    const dx = bx;
    const dy = by;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
    }

    const projLng = lngA + t * (lngB - lngA);
    const projLat = latA + t * (latB - latA);

    const dist = distanceMeters(
      { latitude: point.latitude, longitude: point.longitude },
      { latitude: projLat, longitude: projLng }
    );

    if (dist < minDistance) {
      minDistance = dist;
      bestLat = projLat;
      bestLng = projLng;
      bestSegment = i;

      // Góc phương vị của phân đoạn đường
      const segBearing = (Math.atan2(dx, dy) * toDeg + 360) % 360;
      bestBearing = segBearing;
    }
  }

  if (minDistance <= maxDistanceM) {
    return {
      latitude: bestLat,
      longitude: bestLng,
      elevation: point.elevation ?? undefined,
      snapped: true,
      distanceToRouteM: minDistance,
      segmentIndex: bestSegment,
      bearingDeg: bestBearing,
    };
  }

  return {
    latitude: point.latitude,
    longitude: point.longitude,
    elevation: point.elevation ?? undefined,
    snapped: false,
    distanceToRouteM: minDistance,
    segmentIndex: bestSegment,
    bearingDeg: bestBearing,
  };
}
