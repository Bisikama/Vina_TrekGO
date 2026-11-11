import type { MapCheckpoint } from "@/components/map/MapLibre3DView";
import type { LeaderCheckpointDetail } from "@/features/leaders/services/leader-public-trips.api";

type Position = [number, number];

function isPosition(value: unknown): value is Position {
  if (!Array.isArray(value)) return false;
  const [longitude, latitude] = value;
  return Number.isFinite(longitude) && Math.abs(longitude) <= 180 &&
    Number.isFinite(latitude) && Math.abs(latitude) <= 90;
}

function isLine(value: unknown): value is Position[] {
  return Array.isArray(value) && value.length >= 2 && value.every(isPosition);
}

function readRouteLines(geojson: unknown): Position[][] {
  if (!geojson || typeof geojson !== "object") return [];
  const { type, coordinates, geometry, features } = geojson as Record<string, unknown>;

  switch (type) {
    case "LineString": return isLine(coordinates) ? [coordinates] : [];
    case "MultiLineString": return Array.isArray(coordinates) ? coordinates.filter(isLine) : [];
    case "Feature": return readRouteLines(geometry);
    case "FeatureCollection": return Array.isArray(features) ? features.flatMap(readRouteLines) : [];
    default: return [];
  }
}

export function getTripReviewMap(geojson: unknown, checkpoints: LeaderCheckpointDetail[]) {
  const plannedRoute = readRouteLines(geojson);
  const markers = checkpoints.flatMap<MapCheckpoint>((checkpoint, index) => {
    const longitude = Number(checkpoint.longitude);
    const latitude = Number(checkpoint.latitude);
    if (!isPosition([longitude, latitude])) return [];
    const order = checkpoint.sequence ?? index + 1;
    return [{ id: checkpoint.sourceCheckpointId ?? checkpoint.id ?? String(order), name: checkpoint.name, order, latitude, longitude }];
  });

  const [firstMarker] = markers;
  const first = plannedRoute[0]?.[0] ?? (firstMarker ? [firstMarker.longitude, firstMarker.latitude] : undefined);
  if (!first) return { plannedRoute, markers, bounds: null };
  const bounds: [Position, Position] = [[first[0], first[1]], [first[0], first[1]]];
  function extend([lng, lat]: Position) {
    const [southwest, northeast] = bounds;
    southwest[0] = Math.min(southwest[0], lng);
    southwest[1] = Math.min(southwest[1], lat);
    northeast[0] = Math.max(northeast[0], lng);
    northeast[1] = Math.max(northeast[1], lat);
  }
  for (const line of plannedRoute) for (const point of line) extend(point);
  for (const marker of markers) extend([marker.longitude, marker.latitude]);

  return { plannedRoute, markers, bounds };
}
