import { RawGpsSample } from "@/types";
import { GPS_CONFIG } from "@/utils/gpsProcessor";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  createDeterministicUuid,
  recordingDatabase,
} from "../storage/recordingDatabase";

export const BACKGROUND_LOCATION_TASK = "trekgo-background-location";

type BackgroundLocationData = {
  locations: Location.LocationObject[];
};

export function createLocationSampleId(
  recordingId: string,
  location: Location.LocationObject,
): string {
  const { latitude, longitude } = location.coords;
  return createDeterministicUuid(
    `${recordingId}:${Math.round(location.timestamp)}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`,
  );
}

function toRawSample(
  recordingId: string,
  segmentId: number,
  location: Location.LocationObject,
): RawGpsSample {
  const { coords } = location;
  const validCoordinates =
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    Math.abs(coords.latitude) <= 90 &&
    Math.abs(coords.longitude) <= 180;
  const accurateEnough =
    coords.accuracy == null || coords.accuracy <= GPS_CONFIG.maxAccuracyM;
  const accepted = validCoordinates && accurateEnough;

  return {
    clientSampleId: createLocationSampleId(recordingId, location),
    clientRecordingId: recordingId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    recordedAt: new Date(location.timestamp).toISOString(),
    accuracyM: coords.accuracy ?? null,
    altitudeM: coords.altitude ?? null,
    altitudeAccuracyM: coords.altitudeAccuracy ?? null,
    speedMps: coords.speed ?? null,
    headingDeg: coords.heading ?? null,
    segmentId,
    accepted,
    rejectReason: accepted
      ? null
      : validCoordinates
        ? "LOW_ACCURACY"
        : "INVALID_COORDS",
  };
}

if (Platform.OS !== "web") {
  TaskManager.defineTask<BackgroundLocationData>(
    BACKGROUND_LOCATION_TASK,
    async ({ data, error }) => {
      if (error || !data?.locations?.length) return;

      const recording = await recordingDatabase.getActiveRecording();
      if (!recording || recording.status !== "RECORDING") return;

      for (const location of data.locations) {
        if (!Number.isFinite(location.timestamp) || location.timestamp < Date.parse(recording.startedAt)) continue;
        await recordingDatabase.insertRawSample(
          toRawSample(
            recording.clientRecordingId,
            recording.nextSegmentId,
            location,
          ),
        );
      }
    },
  );
}

export async function startBackgroundLocationUpdates(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const available = await Location.isBackgroundLocationAvailableAsync();
  const permission = await Location.getBackgroundPermissionsAsync();
  if (!available || permission.status !== "granted") return false;

  const started = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK,
  );
  if (started) return true;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy:
      Platform.OS === "ios"
        ? Location.Accuracy.BestForNavigation
        : Location.Accuracy.High,
    distanceInterval: 5,
    timeInterval: 5_000,
    deferredUpdatesDistance: 10,
    deferredUpdatesInterval: 10_000,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "TrekGo đang ghi hành trình",
      notificationBody: "Vị trí đang được lưu để không mất cung đường khi tắt màn hình.",
      notificationColor: "#208AEF",
      killServiceOnDestroy: false,
    },
  });
  return true;
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  if (Platform.OS === "web") return;
  const started = await Location.hasStartedLocationUpdatesAsync(
    BACKGROUND_LOCATION_TASK,
  );
  if (started) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
