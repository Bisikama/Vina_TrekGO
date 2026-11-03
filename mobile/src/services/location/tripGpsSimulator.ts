import type * as Location from 'expo-location';
import { distanceMeters } from '@/utils/gpsProcessor';

export interface TripGpsSimulatorConfig {
  routeCoords: [number, number][]; // [longitude, latitude][]
  speedMps?: number; // Tốc độ di chuyển giả lập (m/s), mặc định 3.0 m/s (~10.8 km/h)
  intervalMs?: number; // Chu kỳ phát mẫu (ms), mặc định 3000 ms
  accuracyM?: number; // Độ chính xác giả lập (m), mặc định 5 m
  altitudeM?: number; // Độ cao giả lập (m), mặc định 1200 m
}

type LocationListener = (sample: Location.LocationObject) => void;

/**
 * Trình giả lập GPS cho chuyến đi (Trip GPS Simulator):
 * Di chuyển mượt mà từ điểm đầu đến điểm cuối dọc theo cung đường kế hoạch (plannedRouteCoords).
 */
export class TripGpsSimulator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listener: LocationListener | null = null;
  private alongM = 0;
  private lastTick = 0;
  private playing = false;
  private lengths: number[] = [];
  private totalM = 0;
  private routeCoords: [number, number][] = [];
  private speedMps = 3.0;
  private intervalMs = 3000;
  private accuracyM = 5;
  private altitudeM = 1200;

  constructor(config: TripGpsSimulatorConfig) {
    this.updateRoute(config.routeCoords);
    if (config.speedMps && config.speedMps > 0) this.speedMps = config.speedMps;
    if (config.intervalMs && config.intervalMs >= 500) this.intervalMs = config.intervalMs;
    if (config.accuracyM != null) this.accuracyM = config.accuracyM;
    if (config.altitudeM != null) this.altitudeM = config.altitudeM;
  }

  updateRoute(routeCoords: [number, number][]) {
    this.routeCoords = Array.isArray(routeCoords) ? routeCoords.filter(p => Array.isArray(p) && p.length >= 2) : [];
    this.lengths = [];
    this.totalM = 0;
    for (let i = 0; i < this.routeCoords.length - 1; i++) {
      const a = { longitude: this.routeCoords[i][0], latitude: this.routeCoords[i][1] };
      const b = { longitude: this.routeCoords[i + 1][0], latitude: this.routeCoords[i + 1][1] };
      const d = distanceMeters(a, b);
      this.lengths.push(d);
      this.totalM += d;
    }
  }

  setSpeed(speedMps: number) {
    if (speedMps > 0) this.speedMps = speedMps;
  }

  getCurrentLocation(now = Date.now()): Location.LocationObject | null {
    if (this.routeCoords.length === 0) return null;
    if (this.routeCoords.length === 1) {
      return {
        timestamp: now,
        mocked: true,
        coords: {
          latitude: this.routeCoords[0][1],
          longitude: this.routeCoords[0][0],
          altitude: this.altitudeM,
          accuracy: this.accuracyM,
          altitudeAccuracy: 3,
          heading: 0,
          speed: 0,
        },
      };
    }

    let remaining = this.alongM;
    let index = 0;
    while (index < this.lengths.length - 1 && remaining >= this.lengths[index]) {
      remaining -= this.lengths[index++];
    }

    const aLng = this.routeCoords[index][0];
    const aLat = this.routeCoords[index][1];
    const bLng = this.routeCoords[index + 1][0];
    const bLat = this.routeCoords[index + 1][1];

    const segLen = this.lengths[index];
    const f = segLen > 0 ? Math.min(1, remaining / segLen) : 1;

    const deltaLng = ((bLng - aLng + 540) % 360) - 180;
    const rad = Math.PI / 180;
    const y = Math.sin(deltaLng * rad) * Math.cos(bLat * rad);
    const x =
      Math.cos(aLat * rad) * Math.sin(bLat * rad) -
      Math.sin(aLat * rad) * Math.cos(bLat * rad) * Math.cos(deltaLng * rad);
    const heading = (Math.atan2(y, x) / rad + 360) % 360;

    const lat = aLat + (bLat - aLat) * f;
    const lng = ((aLng + deltaLng * f + 540) % 360) - 180;

    return {
      timestamp: now,
      mocked: true,
      coords: {
        latitude: lat,
        longitude: lng,
        altitude: this.altitudeM,
        accuracy: this.accuracyM,
        altitudeAccuracy: 3,
        heading,
        speed: this.playing && this.alongM < this.totalM ? this.speedMps : 0,
      },
    };
  }

  start(listener: LocationListener, paused = false): { remove: () => void } {
    this.stop();
    this.listener = listener;
    this.playing = !paused && this.alongM < this.totalM;
    this.lastTick = Date.now();

    // Phát tọa độ ban đầu ngay lập tức
    const initial = this.getCurrentLocation(this.lastTick);
    if (initial) {
      this.listener(initial);
    }

    this.timer = setInterval(() => this.tick(), this.intervalMs);

    return {
      remove: () => this.stop(),
    };
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min(this.intervalMs * 2, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    if (!this.playing) return;

    this.alongM = Math.min(this.totalM, this.alongM + (this.speedMps * dt) / 1000);
    const loc = this.getCurrentLocation(now);
    if (loc) {
      this.listener?.(loc);
    }

    if (this.alongM >= this.totalM) {
      this.pause();
    }
  }

  pause() {
    this.playing = false;
  }

  resume() {
    this.lastTick = Date.now();
    this.playing = this.alongM < this.totalM;
  }

  reset() {
    this.alongM = 0;
    this.playing = false;
    this.stop();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.listener = null;
    this.playing = false;
  }
}
