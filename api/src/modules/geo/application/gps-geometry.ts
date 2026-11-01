import { calculateHaversineDistanceM } from '../../elevation/application/ports/elevation-provider.port'
import type { GapConnectionDto, LineString, LastLocationDto, PlannedRouteDto } from './trip-gps.contract'

export interface TrackPoint extends LastLocationDto {
  clientSampleId: string
  sessionId: string
}
export interface ActiveInterval {
  start: string
  end: string | null
}
export const meters = calculateHaversineDistanceM
export const roundDistance = (n: number) => Math.round(n * 100) / 100
export function inInterval(p: TrackPoint, intervals: ActiveInterval[]) {
  return intervals.findIndex((i) => p.recordedAt >= i.start && (!i.end || p.recordedAt <= i.end))
}
/** Total recorded time across sessions; null until every session has stopped. */
export function movingDurationSeconds(
  sessions: { startedAt: Date; endedAt: Date | null; intervals?: ActiveInterval[] }[],
): number | null {
  if (!sessions.length || sessions.some((s) => !s.endedAt)) return null
  let totalMs = 0
  for (const session of sessions) {
    const endedAt = session.endedAt!.toISOString()
    // Same fallback as track assembly for sessions without stored intervals.
    const intervals = session.intervals ?? [{ start: session.startedAt.toISOString(), end: endedAt }]
    for (const interval of intervals) totalMs += Math.max(0, Date.parse(interval.end ?? endedAt) - Date.parse(interval.start))
  }
  return Math.round(totalMs / 1000)
}
export function gapReason(
  a: TrackPoint,
  b: TrackPoint,
  intervals: Map<string, ActiveInterval[]>,
  gapSeconds: number,
): GapConnectionDto['reason'] | null {
  if (a.sessionId !== b.sessionId) return 'BETWEEN_SESSIONS'
  if (inInterval(a, intervals.get(a.sessionId) ?? []) !== inInterval(b, intervals.get(b.sessionId) ?? []))
    return 'PAUSE'
  return (Date.parse(b.recordedAt) - Date.parse(a.recordedAt)) / 1000 > gapSeconds ? 'SIGNAL_GAP' : null
}
export function assembleRoute(points: TrackPoint[], intervals: Map<string, ActiveInterval[]>, gapSeconds: number) {
  let distance = 0
  const gapConnections: GapConnectionDto[] = []
  points.forEach((b, i) => {
    if (!i) return
    const a = points[i - 1],
      d = meters(a, b)
    const reason = gapReason(a, b, intervals, gapSeconds)
    // Unrecorded travel between sessions/active intervals is not measured GPS distance.
    if (!reason) distance += d
    if (reason)
      gapConnections.push({
        fromSampleId: a.clientSampleId,
        toSampleId: b.clientSampleId,
        fromCoordinateIndex: i - 1,
        toCoordinateIndex: i,
        reason,
        durationSeconds: (Date.parse(b.recordedAt) - Date.parse(a.recordedAt)) / 1000,
        straightDistanceMeters: roundDistance(d),
      })
  })
  return {
    routeGeojson:
      points.length < 2
        ? null
        : ({ type: 'LineString', coordinates: points.map((p) => [p.longitude, p.latitude]) } as LineString),
    pointCount: points.length,
    totalDistanceMeters: points.length < 2 ? null : roundDistance(distance),
    gapConnections,
  }
}

const deltaLongitude = (n: number) => ((n + 540) % 360) - 180
function segmentDistance(p: { latitude: number; longitude: number }, a: number[], b: number[]) {
  const scale = Math.cos((p.latitude * Math.PI) / 180),
    unit = (6371000 * Math.PI) / 180
  const ax = deltaLongitude(a[0] - p.longitude) * scale * unit,
    ay = (a[1] - p.latitude) * unit
  const bx = deltaLongitude(b[0] - p.longitude) * scale * unit,
    by = (b[1] - p.latitude) * unit
  const dx = bx - ax,
    dy = by - ay,
    length = dx * dx + dy * dy
  const t = length ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}
export function distanceToRoute(
  p: { latitude: number; longitude: number },
  geometry: PlannedRouteDto['geometry'],
): number | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
  let best = Infinity
  for (const line of lines) {
    if (!Array.isArray(line)) continue
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i]
      if (![a?.[0], a?.[1], b?.[0], b?.[1]].every(Number.isFinite)) continue
      best = Math.min(best, segmentDistance(p, a, b))
    }
  }
  return Number.isFinite(best) ? roundDistance(best) : null
}
export function simplifyLiveRoute(route: ReturnType<typeof assembleRoute>): LineString | null {
  if (!route.routeGeojson) return null
  const coords = route.routeGeojson.coordinates
  const anchors = new Set([
    0,
    coords.length - 1,
    ...route.gapConnections.flatMap((g) => [g.fromCoordinateIndex, g.toCoordinateIndex]),
  ])
  const boundaries = [...anchors].sort((a, b) => a - b)
  const stack = boundaries.slice(1).map((end, i) => [boundaries[i], end])
  while (stack.length) {
    const [start, end] = stack.pop()!
    let farthest = -1,
      max = 5
    for (let i = start + 1; i < end; i++) {
      const distance = segmentDistance({ longitude: coords[i][0], latitude: coords[i][1] }, coords[start], coords[end])
      if (distance > max) {
        farthest = i
        max = distance
      }
    }
    if (farthest >= 0) {
      anchors.add(farthest)
      stack.push([start, farthest], [farthest, end])
    }
  }
  return { type: 'LineString', coordinates: [...anchors].sort((a, b) => a - b).map((i) => coords[i]) }
}
