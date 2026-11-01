export type RouteCoordinate = [number, number];
export interface RoutePoint { x: number; y: number }
export interface RouteInsets { top: number; right: number; bottom: number; left: number }

/** Fits [lng, lat] coordinates into a box, keeping the route's real shape. */
export function projectCoordinates(coordinates: RouteCoordinate[], width: number, height: number, insets: RouteInsets): RoutePoint[] {
  if (coordinates.length === 0) return [];
  const lngs = coordinates.map(c => c[0]);
  const lats = coordinates.map(c => c[1]);
  const minLng = lngs.reduce((a, b) => Math.min(a, b));
  const maxLng = lngs.reduce((a, b) => Math.max(a, b));
  const minLat = lats.reduce((a, b) => Math.min(a, b));
  const maxLat = lats.reduce((a, b) => Math.max(a, b));
  const drawW = Math.max(10, width - insets.left - insets.right);
  const drawH = Math.max(10, height - insets.top - insets.bottom);
  // A straight north-south or east-west route has zero span on one axis.
  const deltaLng = maxLng - minLng > 0.000001 ? maxLng - minLng : 0.0001;
  const deltaLat = maxLat - minLat > 0.000001 ? maxLat - minLat : 0.0001;
  const latFactor = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = Math.min(drawW / (deltaLng * latFactor), drawH / deltaLat);
  const offsetX = insets.left + (drawW - deltaLng * latFactor * scale) / 2;
  const offsetY = insets.top + (drawH - deltaLat * scale) / 2;
  return coordinates.map(([lng, lat]) => ({
    x: offsetX + (lng - minLng) * latFactor * scale,
    y: offsetY + (maxLat - lat) * scale,
  }));
}

/** Splits the route at unrecorded stretches so they aren't drawn as if walked. */
export function splitAtGaps<T>(points: T[], gaps: { fromCoordinateIndex: number; toCoordinateIndex: number }[]): T[][] {
  const segments: T[][] = [];
  let start = 0;
  for (const gap of [...gaps].sort((a, b) => a.fromCoordinateIndex - b.fromCoordinateIndex)) {
    if (gap.fromCoordinateIndex < start || gap.toCoordinateIndex >= points.length) continue;
    segments.push(points.slice(start, gap.fromCoordinateIndex + 1));
    start = gap.toCoordinateIndex;
  }
  segments.push(points.slice(start));
  return segments.filter(segment => segment.length >= 2);
}

export function toSvgPath(points: RoutePoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatRouteDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '--';
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds / 60) % 60)}:${pad(Math.floor(seconds) % 60)}`;
}

/** Pace as mm:ss per km. */
export function formatRoutePace(distanceMeters: number | null | undefined, seconds: number | null | undefined): string {
  if (!distanceMeters || distanceMeters <= 0 || seconds == null || seconds <= 0) return '--';
  const secondsPerKm = Math.round(seconds / (distanceMeters / 1000));
  return `${Math.floor(secondsPerKm / 60)}:${pad(secondsPerKm % 60)}`;
}

export function formatRouteDistanceKm(distanceMeters: number | null | undefined): string {
  return distanceMeters == null ? '--' : (distanceMeters / 1000).toFixed(2);
}

export function formatRouteDate(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}
