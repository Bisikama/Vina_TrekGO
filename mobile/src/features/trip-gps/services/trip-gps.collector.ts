import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { readStoredAuth } from '@/features/auth/storage';
import { createDeterministicUuid } from '@/services/storage/recordingDatabase';
import { appendSample, changeLocalTrip, listLocalTrips, readLocalTrip, type LocalTrip } from './trip-gps.v2-storage';
import type { GpsSample } from '../types';

export const TRIP_GPS_BACKGROUND_TASK = 'trekgo-trip-gps-v2-location';
type SampleListener = (trip: LocalTrip, sample: GpsSample) => void;
let listener: SampleListener | undefined;
let errorListener: ((message: string) => void) | undefined;
let subscription: Location.LocationSubscription | undefined;
let lifecycle: Promise<unknown> = Promise.resolve();
let writes: Promise<unknown> = Promise.resolve();
const inFlightWrites = new Set<Promise<void>>();
let simulationSelected = true;
export function setCollectorSimulation(_value: boolean) { simulationSelected = true; }
export function setCollectorListeners(sample?: SampleListener, error?: (message: string) => void) { listener = sample; errorListener = error; }
export function ingestLocations(account: string, id: string, locations: Location.LocationObject[], source: 'DEVICE' | 'SIMULATOR' = 'DEVICE'): Promise<void> {
  const result = writes.then(async () => {
    const auth = await readStoredAuth();
    if (auth?.user.id !== account) return;
    const trip = await readLocalTrip(account, id);
    for (const location of locations) {
      // OS callbacks already queued before stop can arrive after switching modes.
      if (simulationSelected !== (source === 'SIMULATOR')) continue;
      const c = location.coords;
      if (!Number.isFinite(location.timestamp) || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) ||
        Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180 || c.accuracy == null || !Number.isFinite(c.accuracy) || c.accuracy < 0 || c.accuracy > trip.policy.maxAcceptedAccuracyM) continue;
      if (location.timestamp > Date.now() + trip.policy.maxFutureSkewSeconds * 1000) continue;
      const sample: GpsSample = {
        clientSampleId: createDeterministicUuid(`${id}:${location.timestamp}:${c.latitude}:${c.longitude}`),
        recordedAt: new Date(location.timestamp).toISOString(), latitude: c.latitude, longitude: c.longitude, accuracyM: c.accuracy,
        altitudeM: c.altitude != null && Number.isFinite(c.altitude) ? c.altitude : null,
        speedMps: c.speed != null && Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null,
        headingDeg: c.heading != null && Number.isFinite(c.heading) && c.heading >= 0 && c.heading < 360 ? c.heading : null,
      };
      if (await appendSample(account, id, sample)) listener?.(trip, sample);
    }
  });
  writes = result.catch(() => {});
  inFlightWrites.add(result);
  void result.then(() => inFlightWrites.delete(result), () => inFlightWrites.delete(result));
  return result;
}
async function reportCollectorError(account: string, id: string, error: unknown) {
  const message = `Không ghi được GPS local: ${error instanceof Error ? error.message : String(error)}`;
  errorListener?.(message);
  try { await changeLocalTrip(account, id, t => { t.lastError = message; }); } catch { console.warn('[TripGps storage]', message); }
}
if (Platform.OS !== 'web') TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRIP_GPS_BACKGROUND_TASK, async ({ data, error }) => {
  try {
    const auth = await readStoredAuth();
    if (!auth) return;
    const active = (await listLocalTrips(auth.user.id)).filter(t => t.session.status === 'ACTIVE' && !t.accessBlocked);
    for (const trip of active) {
      try {
        if (error) throw error;
        if (data?.locations?.length) await ingestLocations(auth.user.id, trip.session.id, data.locations);
      } catch (failure) { await reportCollectorError(auth.user.id, trip.session.id, failure); }
    }
  } catch (failure) { console.warn('[TripGps background]', failure); }
});

async function stopNative() {
  subscription?.remove(); subscription = undefined;
  if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(TRIP_GPS_BACKGROUND_TASK)) await Location.stopLocationUpdatesAsync(TRIP_GPS_BACKGROUND_TASK);
}
export function stopTripCollector(): Promise<void> {
  // Preserve failures of writes that Finish is waiting for; the serial queue's
  // catch keeps future samples usable, but must not turn failed writes into success.
  const pending = Promise.allSettled([...inFlightWrites]);
  const result = lifecycle.then(stopNative);
  lifecycle = result.catch(() => {});
  return result.then(async () => {
    await writes;
    const failed = (await pending).find(write => write.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  });
}
export function startTripCollector(_trip: LocalTrip, _requestPermissions = false): Promise<void> {
  // Fake-only: stop leftover native updates without requesting location permissions.
  return stopTripCollector();
}

