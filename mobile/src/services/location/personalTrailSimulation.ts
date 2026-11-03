import type * as Location from "expo-location";
import {
  PERSONAL_TRAIL_SIMULATION,
  type PersonalTrailSimulationConfig,
} from "@/constants/personalTrailSimulation";
import { distanceMeters, GPS_CONFIG } from "@/utils/gpsProcessor";

type Listener = (sample: Location.LocationObject) => void;

/** Local producer only: never patches expo-location or changes device GPS. */
export class PersonalTrailSimulator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listener: Listener | null = null;
  private alongM = 0;
  private lastTick = 0;
  private playing = false;
  private lengths: number[];
  private totalM: number;
  private config: PersonalTrailSimulationConfig;

  constructor(config: PersonalTrailSimulationConfig) {
    this.config = { ...config, route: { ...config.route, points: config.route.points.map(p => ({ ...p })) } };
    const { route, accuracyM, intervalMs, altitudeM } = this.config;
    if (route.points.length < 2) throw new Error("Route giả lập cần ít nhất 2 điểm.");
    if (!Number.isFinite(route.speed) || route.speed <= 0 || route.speed > GPS_CONFIG.maxWalkingSpeedMs)
      throw new Error("Tốc độ giả lập phải lớn hơn 0 và không quá 4.5 m/s.");
    if (!Number.isFinite(intervalMs) || intervalMs < 250 || intervalMs > 3000)
      throw new Error("intervalMs phải từ 250 đến 3000 ms.");
    if (!Number.isFinite(accuracyM) || accuracyM < 0 || !Number.isFinite(altitudeM))
      throw new Error("accuracyM và altitudeM phải hợp lệ; accuracyM không được âm.");
    for (const p of route.points) {
      if (!Number.isFinite(p.latitude) || Math.abs(p.latitude) > 90 ||
          !Number.isFinite(p.longitude) || Math.abs(p.longitude) > 180 ||
          (p.altitudeM !== undefined && !Number.isFinite(p.altitudeM)))
        throw new Error("Tọa độ hoặc độ cao trong route giả lập không hợp lệ.");
    }
    this.lengths = route.points.slice(1).map((p, i) => distanceMeters(route.points[i], p));
    this.totalM = this.lengths.reduce((a, b) => a + b, 0);
    if (this.totalM < 1) throw new Error("Route giả lập phải có chiều dài ít nhất 1 mét.");
  }

  getCurrentLocation(now = Date.now()): Location.LocationObject {
    const { route, accuracyM, altitudeM } = this.config;
    let remaining = this.alongM;
    let index = 0;
    while (index < this.lengths.length - 1 && remaining >= this.lengths[index]) {
      remaining -= this.lengths[index++];
    }
    const a = route.points[index], b = route.points[index + 1];
    const f = this.lengths[index] > 0 ? Math.min(1, remaining / this.lengths[index]) : 1;
    const deltaLng = ((b.longitude - a.longitude + 540) % 360) - 180;
    const rad = Math.PI / 180;
    const y = Math.sin(deltaLng * rad) * Math.cos(b.latitude * rad);
    const x = Math.cos(a.latitude * rad) * Math.sin(b.latitude * rad) -
      Math.sin(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.cos(deltaLng * rad);
    return {
      timestamp: now,
      mocked: true,
      coords: {
        latitude: a.latitude + (b.latitude - a.latitude) * f,
        longitude: ((a.longitude + deltaLng * f + 540) % 360) - 180,
        altitude: (a.altitudeM ?? altitudeM) + ((b.altitudeM ?? altitudeM) - (a.altitudeM ?? altitudeM)) * f,
        accuracy: accuracyM,
        altitudeAccuracy: 3,
        heading: (Math.atan2(y, x) / rad + 360) % 360,
        speed: this.playing && this.alongM < this.totalM ? route.speed : 0,
      },
    };
  }

  subscribe(listener: Listener, paused = false): Location.LocationSubscription {
    this.detach();
    this.listener = listener;
    this.playing = !paused && this.alongM < this.totalM;
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.tick(), this.config.intervalMs);
    // Defer first sample until caller has installed the subscription.
    return { remove: () => this.detach() };
  }

  private tick() {
    const now = Date.now();
    // A JS timer stall must not teleport the walker along the route.
    const dt = Math.min(this.config.intervalMs * 2, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    if (!this.playing) return;
    this.alongM = Math.min(this.totalM, this.alongM + this.config.route.speed * dt / 1000);
    this.listener?.(this.getCurrentLocation(now));
    if (this.alongM >= this.totalM) this.pause();
  }

  pause() {
    this.playing = false;
  }
  resume() {
    this.lastTick = Date.now();
    this.playing = this.alongM < this.totalM;
  }
  private detach() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.listener = null;
    this.playing = false;
  }
  reset() {
    this.detach();
    this.alongM = 0;
  }
}

let simulator: PersonalTrailSimulator | null = null;
export function preparePersonalTrailSimulation() {
  if (!__DEV__) throw new Error("GPS giả lập chỉ dành cho bản phát triển.");
  resetPersonalTrailSimulation();
  simulator = new PersonalTrailSimulator(PERSONAL_TRAIL_SIMULATION);
}
export function getPersonalTrailSimulationLocation() {
  if (!simulator) throw new Error("Chưa chọn GPS giả lập.");
  return simulator.getCurrentLocation();
}
export function startPersonalTrailSimulation(listener: Listener, paused = false) {
  if (!__DEV__ || !simulator) throw new Error("Chưa bật GPS giả lập.");
  return simulator.subscribe(listener, paused);
}
export function pausePersonalTrailSimulation() { simulator?.pause(); }
export function resumePersonalTrailSimulation() { simulator?.resume(); }
export function resetPersonalTrailSimulation() {
  simulator?.reset();
  simulator = null;
}
