import type * as Location from "expo-location";

export interface GpsPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  timestamp: number;
  accuracy: number;
  altitudeAccuracy?: number;
  speed?: number;
  segmentId: number;
}

export interface RawGpsPoint {
  latitude: number;
  longitude: number;
  recordedAt: number; // Unix timestamp ms
  accuracyM?: number | null;
  altitudeM?: number | null;
  altitudeAccuracyM?: number | null;
  speedMps?: number | null;
  headingDeg?: number | null;
}

export type ProcessResult = {
  accepted: boolean;
  reason?: string;
  rawPoint?: RawGpsPoint;
  point?: GpsPoint;
  addedDistanceM: number;
  distanceM: number;
  elevationGainM: number;
  speedKmh: number;
  isNewSegment?: boolean;
};

export interface GpsProcessorSnapshot {
  currentSegmentId: number;
  distanceM: number;
  elevationGainM: number;
  lastObservedTimestamp: number;
  lastPoint: GpsPoint | null;
  smoothedElevation: number | null;
  elevationAnchor: number | null;
}

export const GPS_CONFIG = {
  maxAccuracyM: 25,
  minMovementM: 5,
  maxWalkingSpeedMs: 4.5, // ~16.2 km/h (giới hạn tốc độ trekking/chạy địa hình)
  maxPointAgeMs: 45000,
  maxTrackingGapMs: 15000, // 15 giây: khoảng trống GPS quá lâu sẽ tách segment mới
  elevationAccuracyM: 15,
  elevationAlpha: 0.2, // Trọng số bộ lọc EMA làm mượt độ cao
  elevationThresholdM: 5, // Ngưỡng dốc tích lũy tối thiểu (Hysteresis)
};

export function distanceMeters(
  a: Pick<GpsPoint, "latitude" | "longitude">,
  b: Pick<GpsPoint, "latitude" | "longitude">,
): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
}

export class GpsProcessor {
  private currentSegmentId = 0;
  private lastPoint: GpsPoint | null = null;
  private lastObservedTimestamp = 0;
  private distanceM = 0;
  private elevationGainM = 0;
  private smoothedElevation: number | null = null;
  private elevationAnchor: number | null = null;
  private recordingStartedAt = 0;
  private awaitingStartFix = false;
  private startFixes: RawGpsPoint[] = [];

  getCurrentSegmentId(): number {
    return this.currentSegmentId;
  }

  setCurrentSegmentId(id: number) {
    this.currentSegmentId = Math.max(0, Math.floor(id));
  }

  reset(recordingStartedAt = 0) {
    this.recordingStartedAt = recordingStartedAt;
    this.awaitingStartFix = recordingStartedAt > 0;
    this.startFixes = [];
    this.currentSegmentId = 0;
    this.lastPoint = null;
    this.lastObservedTimestamp = 0;
    this.distanceM = 0;
    this.elevationGainM = 0;
    this.smoothedElevation = null;
    this.elevationAnchor = null;
  }

  breakSegment() {
    this.currentSegmentId++;
    this.lastPoint = null;
    this.lastObservedTimestamp = 0;
    this.smoothedElevation = null;
    this.elevationAnchor = null;
  }

  getSnapshot(): GpsProcessorSnapshot {
    return {
      currentSegmentId: this.currentSegmentId,
      distanceM: this.distanceM,
      elevationGainM: this.elevationGainM,
      lastObservedTimestamp: this.lastObservedTimestamp,
      lastPoint: this.lastPoint ? { ...this.lastPoint } : null,
      smoothedElevation: this.smoothedElevation,
      elevationAnchor: this.elevationAnchor,
    };
  }

  restoreSnapshot(snapshot: Partial<GpsProcessorSnapshot>) {
    if (snapshot.currentSegmentId != null && Number.isFinite(snapshot.currentSegmentId)) {
      this.currentSegmentId = Math.max(0, Math.floor(snapshot.currentSegmentId));
    }
    if (snapshot.distanceM != null && Number.isFinite(snapshot.distanceM) && snapshot.distanceM >= 0) {
      this.distanceM = snapshot.distanceM;
    }
    if (snapshot.elevationGainM != null && Number.isFinite(snapshot.elevationGainM) && snapshot.elevationGainM >= 0) {
      this.elevationGainM = snapshot.elevationGainM;
    }
    if (snapshot.lastObservedTimestamp != null && Number.isFinite(snapshot.lastObservedTimestamp)) {
      this.lastObservedTimestamp = snapshot.lastObservedTimestamp;
    }
    if (snapshot.lastPoint) {
      this.lastPoint = { ...snapshot.lastPoint };
    }
    if (snapshot.smoothedElevation != null && Number.isFinite(snapshot.smoothedElevation)) {
      this.smoothedElevation = snapshot.smoothedElevation;
    }
    if (snapshot.elevationAnchor != null && Number.isFinite(snapshot.elevationAnchor)) {
      this.elevationAnchor = snapshot.elevationAnchor;
    }
  }

  process(loc: Location.LocationObject): ProcessResult {
    const c = loc.coords;
    const timestamp = loc.timestamp;
    const accuracy = c.accuracy;

    const rawPoint: RawGpsPoint = {
      latitude: c.latitude,
      longitude: c.longitude,
      recordedAt: timestamp,
      accuracyM: c.accuracy ?? null,
      altitudeM: c.altitude ?? null,
      altitudeAccuracyM: c.altitudeAccuracy ?? null,
      speedMps: c.speed ?? null,
      headingDeg: c.heading ?? null,
    };

    const reject = (reason: string): ProcessResult => ({
      accepted: false,
      reason,
      rawPoint,
      addedDistanceM: 0,
      distanceM: this.distanceM,
      elevationGainM: this.elevationGainM,
      speedKmh: 0,
    });

    // 1. Kiểm tra toạ độ hợp lệ
    if (
      !Number.isFinite(c.latitude) ||
      !Number.isFinite(c.longitude) ||
      Math.abs(c.latitude) > 90 ||
      Math.abs(c.longitude) > 180
    ) {
      return reject("INVALID_COORDINATE");
    }

    // 2. Kiểm tra độ chính xác ngang (Horizontal Accuracy)
    if (
      accuracy == null ||
      !Number.isFinite(accuracy) ||
      accuracy < 0 ||
      accuracy > GPS_CONFIG.maxAccuracyM
    ) {
      this.startFixes = [];
      return reject("LOW_ACCURACY");
    }

    // 3. Kiểm tra độ tươi của toạ độ (maxPointAgeMs) và thứ tự thời gian
    if (
      !Number.isFinite(timestamp) ||
      timestamp < this.recordingStartedAt ||
      timestamp <= this.lastObservedTimestamp ||
      Math.abs(Date.now() - timestamp) > GPS_CONFIG.maxPointAgeMs
    ) {
      return reject("STALE_LOCATION");
    }

    this.lastObservedTimestamp = timestamp;

    // Confirm a fresh cluster before recording the start; never connect warm-up fixes.
    if (this.awaitingStartFix) {
      if (accuracy > 15) {
        this.startFixes = [];
        return reject("LOW_ACCURACY");
      }
      const first = this.startFixes[0];
      const previous = this.startFixes[this.startFixes.length - 1];
      if (first && previous && (
        timestamp - first.recordedAt > 15000 ||
        distanceMeters(first, rawPoint) > 10 ||
        distanceMeters(previous, rawPoint) / ((timestamp - previous.recordedAt) / 1000) > GPS_CONFIG.maxWalkingSpeedMs
      )) {
        this.startFixes = [];
      }
      this.startFixes.push(rawPoint);
      if (this.startFixes.length < 3 || timestamp - this.startFixes[0].recordedAt < 2000) {
        return reject("GPS_JITTER");
      }
      this.awaitingStartFix = false;
      this.startFixes = [];
    }

    let isNewSegment = false;

    // 4. Kiểm tra mất sóng GPS kéo dài (Tracking Gap)
    if (this.lastPoint) {
      const gapMs = timestamp - this.lastPoint.timestamp;
      if (gapMs > GPS_CONFIG.maxTrackingGapMs) {
        // Mất tín hiệu quá lâu -> tách sang segment mới, không cộng đoạn nối không kiểm chứng
        this.breakSegment();
        isNewSegment = true;
      }
    }

    let addedDistanceM = 0;
    let calculatedSpeed = 0;

    // 5. Kiểm tra bước di chuyển (Nhiễu đứng yên & Nhảy vọt toạ độ)
    if (this.lastPoint) {
      const previous = this.lastPoint;
      const dt = (timestamp - previous.timestamp) / 1000;
      if (dt <= 0) return reject("INVALID_TIME");

      const dist = distanceMeters(previous, {
        latitude: c.latitude,
        longitude: c.longitude,
      });

      calculatedSpeed = dist / dt;
      if (calculatedSpeed > GPS_CONFIG.maxWalkingSpeedMs) {
        return reject("GPS_JUMP");
      }

      const noiseThreshold = Math.max(
        GPS_CONFIG.minMovementM,
        Math.min(15, (previous.accuracy + accuracy) * 0.5),
      );
      if (dist < noiseThreshold) {
        return reject("GPS_JITTER");
      }

      addedDistanceM = dist;
    } else {
      isNewSegment = true;
    }

    // 6. ĐIỂM ĐÃ ĐƯỢC CHẤP NHẬN -> BÂY GIỜ MỚI CẬP NHẬT EMA VÀ COMMIT VÀO BỘ NHỚ
    // (Khắc phục lỗi: điểm bị reject làm sai lệch smoothedElevation)
    const altitudeValid =
      c.altitude != null &&
      Number.isFinite(c.altitude) &&
      (c.altitudeAccuracy == null ||
        (Number.isFinite(c.altitudeAccuracy) &&
          c.altitudeAccuracy >= 0 &&
          c.altitudeAccuracy <= GPS_CONFIG.elevationAccuracyM));

    let finalElevation: number | undefined = undefined;

    if (altitudeValid) {
      const rawAltitude = c.altitude as number;
      this.smoothedElevation =
        this.smoothedElevation === null
          ? rawAltitude
          : GPS_CONFIG.elevationAlpha * rawAltitude +
            (1 - GPS_CONFIG.elevationAlpha) * this.smoothedElevation;

      finalElevation = this.smoothedElevation;

      // Tính lũy kế độ cao (Elevation Gain) kèm cơ chế Hysteresis
      if (this.elevationAnchor === null) {
        this.elevationAnchor = this.smoothedElevation;
      } else {
        const delta = this.smoothedElevation - this.elevationAnchor;
        if (delta >= GPS_CONFIG.elevationThresholdM) {
          this.elevationGainM += delta;
          this.elevationAnchor = this.smoothedElevation;
        } else if (delta <= -GPS_CONFIG.elevationThresholdM) {
          // Ngưỡng trễ xuống dốc (hysteresis), không reset anchor trên các dao động nhỏ
          this.elevationAnchor = this.smoothedElevation;
        }
      }
    }

    this.distanceM += addedDistanceM;

    const acceptedPoint: GpsPoint = {
      latitude: c.latitude,
      longitude: c.longitude,
      elevation: finalElevation,
      timestamp,
      accuracy,
      altitudeAccuracy: c.altitudeAccuracy ?? undefined,
      speed:
        c.speed != null && Number.isFinite(c.speed) && c.speed >= 0
          ? c.speed
          : calculatedSpeed,
      segmentId: this.currentSegmentId,
    };

    this.lastPoint = acceptedPoint;

    return {
      accepted: true,
      rawPoint,
      point: acceptedPoint,
      addedDistanceM,
      distanceM: this.distanceM,
      elevationGainM: this.elevationGainM,
      speedKmh: (acceptedPoint.speed ?? calculatedSpeed) * 3.6,
      isNewSegment,
    };
  }
}
