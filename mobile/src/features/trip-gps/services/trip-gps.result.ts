import type { ActualRouteResponse, LocalSyncStatus, GpsSample, SessionDto } from '../types';
import { distanceMeters } from '@/utils/gpsProcessor';

export function getLocalTripDistance(samples: GpsSample[], intervals: SessionDto['recordingIntervals'], signalGapSeconds = 15): number {
  let total = 0;
  for (let index = 1; index < samples.length; index++) {
    const a = samples[index - 1], b = samples[index];
    const start = Date.parse(a.recordedAt), end = Date.parse(b.recordedAt);
    if (end <= start || end - start > signalGapSeconds * 1000) continue;
    if (intervals?.length && !intervals.some(i => start >= Date.parse(i.start) && (!i.end || end <= Date.parse(i.end)))) continue;
    total += distanceMeters(a, b);
  }
  return total;
}

/** Summary stays local; sync completion changes only its independent sync badge. */
export function getTripGpsResult(_actualRoute: ActualRouteResponse | null, syncStatus: LocalSyncStatus | undefined,
  liveRouteCoords: [number, number][] | undefined, distanceKm = '0.00') {
  const isReady = syncStatus === 'SYNCED';
  return {
    isReady,
    distanceKm,
    pointCount: liveRouteCoords?.length ?? 0,
    routeCoords: liveRouteCoords ?? [],
  };
}
