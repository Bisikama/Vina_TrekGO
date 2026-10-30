import { blockPersonalTrailWrites, allowPersonalTrailWrites, drainPersonalTrailWrites } from "@/services/storage/personalTrailWrites";
import { PERSONAL_TRAIL_SIMULATION } from "@/constants/personalTrailSimulation";
import {
  preparePersonalTrailSimulation,
  getPersonalTrailSimulationLocation,
  startPersonalTrailSimulation,
  pausePersonalTrailSimulation,
  resumePersonalTrailSimulation,
  resetPersonalTrailSimulation,
} from "@/services/location/personalTrailSimulation";
import {
  MapCheckpoint,
  MapCoordinate,
  MapLibre3DView,
  MapLibre3DViewRef,
} from "@/components/map/MapLibre3DView";
import { Colors, Radius, Shadows } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import {
  generateUUID,
  recordingDatabase,
  syncService,
} from "@/services/storage";
import {
  createLocationSampleId,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
} from "@/services/location/backgroundLocationTask";
import {
  DifficultyLevel,
  PersonalTrail,
  RawGpsSample,
  mapRejectReason,
} from "@/types";
import {
  GpsPoint,
  GpsProcessor,
  distanceMeters,
} from "@/utils/gpsProcessor";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  AppState,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface LiveTrailRecorderModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (trailId: string, trail?: PersonalTrail) => void;
}

export const LiveTrailRecorderModal: React.FC<LiveTrailRecorderModalProps> = ({
  visible,
  onClose,
  onSaved,
}) => {
  const { createPersonalTrail } = useApp();
  const [isSimulated, setIsSimulated] = useState(false);
  const [isSwitchingGps, setIsSwitchingGps] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const startPendingRef = useRef(false);
  const operationLock = useRef(false);
  const saveLock = useRef(false);
  const recoveryPending = useRef(false);
  const storageWarningShown = useRef(false);
  const endedAtRef = useRef<string | null>(null);
  const simulatedRef = useRef(false);
  const locationGenerationRef = useRef(0);
  const screenVisibleRef = useRef(visible);
  useEffect(() => { screenVisibleRef.current = visible; }, [visible]);


  // Trạng thái ghi nhận
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Chế độ camera tự bám theo GPS (Follow Mode): bật khi bắt đầu, tắt khi người dùng chủ động vuốt/zoom bản đồ
  const [isFollowingUser, setIsFollowingUser] = useState(true);

  // Số liệu telemetry Strava style
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [elevationGainM, setElevationGainM] = useState(0);

  // Nhịp độ trung bình (Pace: phút:giây / km) theo phong cách Strava
  const averagePace = useMemo(() => {
    if (distanceKm < 0.05 || elapsedSeconds === 0) {
      return "--:--";
    }
    const paceSecondsPerKm = elapsedSeconds / distanceKm;
    if (!isFinite(paceSecondsPerKm) || paceSecondsPerKm > 3600) {
      return "--:--";
    }
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.floor(paceSecondsPerKm % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }, [distanceKm, elapsedSeconds]);

  // Dữ liệu GPS
  const [recordedCoordinates, setRecordedCoordinates] = useState<GpsPoint[]>(
    [],
  );
  const [currentPosition, setCurrentPosition] = useState<MapCoordinate | null>(
    null,
  );
  const [checkpoints, setCheckpoints] = useState<MapCheckpoint[]>([]);
  const [gpsStatus, setGpsStatus] = useState<
    "SEARCHING" | "READY" | "DENIED" | "SIMULATED"
  >("SEARCHING");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  // Modal lưu cung đường
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trailName, setTrailName] = useState("");
  const [trailRegion, setTrailRegion] = useState("Lâm Đồng");
  const [trailDifficulty] = useState<DifficultyLevel>("Trung bình");
  const [trailDescription, setTrailDescription] = useState("");

  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapLibre3DViewRef>(null);
  const gpsProcessorRef = useRef(new GpsProcessor());
  const isPausedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const currentRecordingIdRef = useRef<string | null>(null);
  const samplesSinceLastSyncRef = useRef(0);
  const recordedCoordinatesRef = useRef<GpsPoint[]>([]);
  const lastRouteRenderAtRef = useRef(0);

  const replaceRecordedCoordinates = useCallback((points: GpsPoint[]) => {
    recordedCoordinatesRef.current = [...points];
    lastRouteRenderAtRef.current = Date.now();
    setRecordedCoordinates([...points]);
  }, []);

  const appendRecordedCoordinate = useCallback((point: GpsPoint) => {
    recordedCoordinatesRef.current.push(point);
    const now = Date.now();
    if (now - lastRouteRenderAtRef.current >= 10_000) {
      lastRouteRenderAtRef.current = now;
      setRecordedCoordinates([...recordedCoordinatesRef.current]);
    }
  }, []);

  // Hàm xác định toạ độ GPS tức thì của người dùng (chỉ dùng để hiển thị ban đầu, không đưa vào bản ghi thật)
  const detectCurrentLocation = useCallback(async (): Promise<MapCoordinate | null> => {
    const generation = locationGenerationRef.current;
    if (simulatedRef.current) {
      const sample = getPersonalTrailSimulationLocation();
      const position = { latitude: sample.coords.latitude, longitude: sample.coords.longitude, elevation: sample.coords.altitude };
      setCurrentPosition(position);
      setGpsStatus("SIMULATED");
      mapRef.current?.centerOnUser(position.longitude, position.latitude);
      return position;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (generation !== locationGenerationRef.current || !screenVisibleRef.current) return null;
      if (status !== "granted") {
        setGpsStatus("DENIED");
        Alert.alert(
          "Quyền GPS",
          "TrekGo cần quyền truy cập vị trí để hiển thị vị trí và ghi nhận cung đường thực tế của bạn.",
        );
        return null;
      }

      // 1. Thử lấy vị trí lưu gần nhất
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 10000,
          requiredAccuracy: 25,
        });
        if (lastKnown && !isRecordingRef.current && generation === locationGenerationRef.current) {
          const altitude =
            lastKnown.coords.altitude != null
              ? Math.round(lastKnown.coords.altitude)
              : undefined;
          const coord: MapCoordinate = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            elevation: altitude,
          };
          setCurrentPosition(coord);
          setGpsAccuracy(lastKnown.coords.accuracy || null);
          setGpsStatus("SEARCHING");
          mapRef.current?.centerOnUser(coord.longitude, coord.latitude);
        }
      } catch {
        // bỏ qua nếu thiết bị chưa từng có cache vị trí
      }

      // 2. Lấy vị trí GPS tươi mới
      let fresh: Location.LocationObject | null = null;
      try {
        fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch {
        try {
          fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch {
          // Bỏ qua nếu mất sóng
        }
      }

      if (generation !== locationGenerationRef.current || !screenVisibleRef.current) return null;
      if (fresh) {
        const altitude =
          fresh.coords.altitude != null
            ? Math.round(fresh.coords.altitude)
            : undefined;
        const coord: MapCoordinate = {
          latitude: fresh.coords.latitude,
          longitude: fresh.coords.longitude,
          elevation: altitude,
        };
        if (isRecordingRef.current) return coord;
        setCurrentPosition(coord);
        setGpsAccuracy(fresh.coords.accuracy || null);
        setGpsStatus("READY");
        mapRef.current?.centerOnUser(coord.longitude, coord.latitude);
        return coord;
      }

      if (!isRecordingRef.current) setGpsStatus("SEARCHING");
      return null;
    } catch (e) {
      console.warn("[LiveTrailRecorder] detectCurrentLocation error:", e);
      setGpsStatus("SEARCHING");
      return null;
    }
  }, []);

  const resetSession = () => {
    endedAtRef.current = null;
    const wasSimulated = simulatedRef.current;
    locationGenerationRef.current += 1;
    if (simulatedRef.current) {
      locationSubscription.current?.remove();
      resetPersonalTrailSimulation();
      simulatedRef.current = false;
      setIsSimulated(false);
    }
    isRecordingRef.current = false;
    isPausedRef.current = false;
    currentRecordingIdRef.current = null;
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    gpsProcessorRef.current.reset();
    setIsRecording(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setDistanceKm(0);
    setElevationGainM(0);
    setCurrentSpeedKmh(0);
    replaceRecordedCoordinates([]);
    setCheckpoints([]);
    if (!wasSimulated) void stopBackgroundLocationUpdates().catch(console.warn);
  };

  // Timer đếm giây
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused]);

  const processLocationSample = useCallback((location: Location.LocationObject) => {
    if (!isRecordingRef.current || isPausedRef.current) return;

    const recId = currentRecordingIdRef.current;
    const result = gpsProcessorRef.current.process(location);
    const raw = result.rawPoint;
    setGpsAccuracy(location.coords.accuracy ?? null);

    // 1. Lưu RAW GPS SAMPLE vào SQLite dùng result.rawPoint và mapRejectReason
    if (recId && raw && Number.isFinite(raw.recordedAt)) {
      const rawSample: RawGpsSample = {
        clientSampleId: createLocationSampleId(recId, location),
        clientRecordingId: recId,
        latitude: raw.latitude,
        longitude: raw.longitude,
        recordedAt: new Date(raw.recordedAt).toISOString(),
        accuracyM: raw.accuracyM ?? null,
        altitudeM: raw.altitudeM ?? null,
        altitudeAccuracyM: raw.altitudeAccuracyM ?? null,
        speedMps: raw.speedMps ?? null,
        headingDeg: raw.headingDeg ?? null,
        segmentId:
          result.point?.segmentId ??
          gpsProcessorRef.current.getCurrentSegmentId(),
        accepted: result.accepted,
        rejectReason: mapRejectReason(result.reason),
      };

      recordingDatabase
        .insertRawSample(rawSample)
        .then(() => {
          samplesSinceLastSyncRef.current += 1;
          if (samplesSinceLastSyncRef.current >= 50) {
            samplesSinceLastSyncRef.current = 0;
            recordingDatabase
              .enqueueOutbox(recId, "BATCH_POINTS", {})
              .then(() => syncService.processSyncOutbox())
              .catch(console.warn);
          }
        })
        .catch((err) => {
          console.warn(
            "[LiveTrailRecorder] Error inserting raw sample:",
            err,
          );
          if (!storageWarningShown.current) {
            storageWarningShown.current = true;
            Alert.alert("GPS chưa được lưu đầy đủ", "Bộ nhớ đang bận. Hãy giữ ứng dụng mở và thử Hoàn tất lại; chưa nên tắt ứng dụng.");
          }
        });
    }

    // Đồng bộ segmentId nếu processor tự động tách segment do gap > 15s
    if (result.isNewSegment && recId) {
      recordingDatabase.incrementSegmentId(recId).catch(console.warn);
    }

    // 2. Điểm bị filter từ chối -> không đưa vào tuyến live và telemetry
    if (!result.accepted || !result.point) {
      return;
    }

    const pt = result.point;
    const currentCoord: MapCoordinate = {
      latitude: pt.latitude,
      longitude: pt.longitude,
      elevation:
        pt.elevation != null ? Math.round(pt.elevation) : undefined,
    };

    setCurrentPosition(currentCoord);
    appendRecordedCoordinate(pt);
    setDistanceKm(result.distanceM / 1000);
    setElevationGainM(result.elevationGainM);
    setCurrentSpeedKmh(result.speedKmh);
    setGpsStatus(simulatedRef.current ? "SIMULATED" : "READY");
  }, [appendRecordedCoordinate]);

  // Yêu cầu quyền vị trí và lắng nghe GPS
  const startLocationTracking = useCallback(async () => {
    const generation = locationGenerationRef.current;
    try {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
      if (simulatedRef.current) {
        locationSubscription.current = startPersonalTrailSimulation(processLocationSample, isPausedRef.current);
        return true;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!screenVisibleRef.current || generation !== locationGenerationRef.current) return false;
      if (status !== "granted") {
        setGpsStatus("DENIED");
        Alert.alert(
          "Quyền GPS",
          "TrekGo cần quyền truy cập vị trí để ghi lại cung đường di chuyển của bạn.",
        );
        return false;
      }

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert(
          "GPS chưa bật",
          `Vui lòng bật dịch vụ vị trí trên ${Platform.OS === "ios" ? "iPhone" : "thiết bị Android"}.`,
        );
        return false;
      }

      try {
        const targetAccuracy =
          Platform.OS === "ios"
            ? Location.Accuracy.BestForNavigation
            : Location.Accuracy.High;

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: targetAccuracy,
            distanceInterval: 1, // Nhận sự kiện di chuyển từ 1 mét
            timeInterval: 3000, // Cập nhật nhịp tim 3 giây / lần
          },
          location => {
            if (screenVisibleRef.current && generation === locationGenerationRef.current) processLocationSample(location);
          },
        );
        if (!screenVisibleRef.current || generation !== locationGenerationRef.current) {
          subscription.remove(); return false;
        }
        locationSubscription.current = subscription;
        return true;
      } catch (watchErr) {
        console.warn(
          "[LiveTrailRecorder] watchPositionAsync failed:",
          watchErr,
        );
        return false;
      }
    } catch (e) {
      console.warn("[LiveTrailRecorder] Location error:", e);
      return false;
    }
  }, [processLocationSample]);

  // Tự động định vị ngay khi mở modal và kiểm tra khôi phục phiên ghi dở dang từ SQLite (Crash Recovery)
  useEffect(() => {
    const recoveryGeneration = locationGenerationRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (visible) {
      timer = setTimeout(() => {
        detectCurrentLocation();
      }, 0);

      // Kiểm tra phiên ghi dở dang nếu modal vừa mở và chưa đang ghi
      if (!isRecordingRef.current) {
        recoveryPending.current = true;
        recordingDatabase
          .getActiveRecording()
          .then(async (active) => {
            if (!screenVisibleRef.current || recoveryGeneration !== locationGenerationRef.current) return;
            if (active) {
              setIsStarting(true);
              Alert.alert(
                "Khôi phục phiên ghi?",
                `Tìm thấy phiên ghi dở dang lúc ${new Date(active.startedAt).toLocaleTimeString("vi-VN")}. Bạn có muốn tiếp tục hành trình không?`,
                [
                  {
                    text: "Hủy phiên cũ",
                    style: "destructive",
                    onPress: async () => {
                      try { await recordingDatabase.deleteRecording(active.clientRecordingId); }
                      catch (error) { Alert.alert("Chưa thể hủy phiên", String(error)); }
                      finally { setIsStarting(false); }
                    },
                  },
                  {
                    text: "Tiếp tục ghi",
                    onPress: async () => {
                      if (!screenVisibleRef.current || recoveryGeneration !== locationGenerationRef.current || operationLock.current) return;
                      operationLock.current = true;
                      try {
                      currentRecordingIdRef.current = active.clientRecordingId;
                      const acceptedSamples =
                        await recordingDatabase.getAcceptedPoints(
                          active.clientRecordingId,
                        );
                      const savedCps = await recordingDatabase.getCheckpoints(
                        active.clientRecordingId,
                      );

                      const restoredPoints: GpsPoint[] = acceptedSamples.map(
                        (s) => ({
                          latitude: s.latitude,
                          longitude: s.longitude,
                          elevation: s.altitudeM ?? undefined,
                          timestamp: new Date(s.recordedAt).getTime(),
                          accuracy: s.accuracyM ?? 10,
                          altitudeAccuracy: s.altitudeAccuracyM ?? undefined,
                          speed: s.speedMps ?? undefined,
                          segmentId: s.segmentId,
                        }),
                      );

                      replaceRecordedCoordinates(restoredPoints);
                      if (restoredPoints.length > 0) {
                        const last = restoredPoints[restoredPoints.length - 1];
                        setCurrentPosition({
                          latitude: last.latitude,
                          longitude: last.longitude,
                          elevation: last.elevation,
                        });
                      }

                      // Khôi phục bộ đếm khoảng cách, độ cao và trạng thái processor
                      let totalDistM = 0;
                      let totalElevM = 0;
                      let maxSeg = active.nextSegmentId || 0;
                      for (let i = 1; i < restoredPoints.length; i++) {
                        const prev = restoredPoints[i - 1];
                        const curr = restoredPoints[i];
                        if (prev.segmentId === curr.segmentId) {
                          totalDistM += distanceMeters(prev, curr);
                        }
                        if (
                          curr.elevation != null &&
                          prev.elevation != null &&
                          curr.elevation > prev.elevation
                        ) {
                          totalElevM += curr.elevation - prev.elevation;
                        }
                        if (curr.segmentId > maxSeg) {
                          maxSeg = curr.segmentId;
                        }
                      }

                      const lastPt =
                        restoredPoints.length > 0
                          ? restoredPoints[restoredPoints.length - 1]
                          : null;

                      gpsProcessorRef.current.reset(Date.parse(active.startedAt));
                      gpsProcessorRef.current.restoreSnapshot({
                        currentSegmentId: maxSeg,
                        distanceM: totalDistM,
                        elevationGainM: totalElevM,
                        lastPoint: lastPt,
                        lastObservedTimestamp: lastPt?.timestamp ?? 0,
                        smoothedElevation: lastPt?.elevation ?? null,
                        elevationAnchor: lastPt?.elevation ?? null,
                      });

                      // Bắt đầu segment mới sau khi khôi phục (không nối xuyên qua thời gian app đóng)
                      gpsProcessorRef.current.breakSegment();
                      recordingDatabase
                        .incrementSegmentId(active.clientRecordingId)
                        .catch(console.warn);

                      // Cập nhật telemetry UI
                      setDistanceKm(totalDistM / 1000);
                      setElevationGainM(Math.round(totalElevM));

                      // Khôi phục thời gian ghi ước tính
                      const startedTime = new Date(active.startedAt).getTime();
                      if (!isNaN(startedTime) && lastPt) {
                        const durationSec = Math.max(
                          0,
                          Math.floor((lastPt.timestamp - startedTime) / 1000),
                        );
                        setElapsedSeconds(durationSec);
                      }

                      setCheckpoints(
                        savedCps.map((c) => ({
                          id: c.clientCheckpointId,
                          order: c.order,
                          name: c.name,
                          latitude: c.latitude ?? 0,
                          longitude: c.longitude ?? 0,
                          elevation: c.elevationLiveM ?? undefined,
                          status: "COMPLETED",
                        })),
                      );

                      setIsRecording(true);
                      isRecordingRef.current = true;
                      const paused = active.status === "PAUSED";
                      setIsPaused(paused);
                      isPausedRef.current = paused;
                      if (!screenVisibleRef.current || recoveryGeneration !== locationGenerationRef.current) return;
                      allowPersonalTrailWrites(active.clientRecordingId);
                      if (!await startLocationTracking()) throw new Error("GPS recovery failed");
                      const backgroundPermission =
                        await Location.getBackgroundPermissionsAsync();
                      if (backgroundPermission.status === "granted") {
                        await startBackgroundLocationUpdates();
                      }
                      } catch (error) { isPausedRef.current = true; setIsPaused(true); Alert.alert("GPS", String(error)); }
                      finally { operationLock.current = false; setIsStarting(false); }
                    },
                  },
                ],
                { cancelable: false },
              );
            }
          })
          .catch(console.warn)
          .finally(() => { recoveryPending.current = false; });
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [
    detectCurrentLocation,
    replaceRecordedCoordinates,
    startLocationTracking,
    visible,
  ]);

  // Clean up the local producer when the personal-trail screen closes.
  useEffect(() => {
    if (!visible) return;
    return () => {
      locationGenerationRef.current += 1;
      locationSubscription.current?.remove();
      if (simulatedRef.current) {
        resetPersonalTrailSimulation();
        simulatedRef.current = false;
        setIsSimulated(false);
      }
    };
  }, [visible]);

  const handleToggleSimulation = async () => {
    if (!__DEV__ || isRecordingRef.current || startPendingRef.current || isSwitchingGps || showSaveForm) return;
    setIsSwitchingGps(true);
    locationGenerationRef.current += 1;
    const switchGeneration = locationGenerationRef.current;
    try {
      if (simulatedRef.current) {
        resetPersonalTrailSimulation();
        simulatedRef.current = false;
        setIsSimulated(false);
        setGpsStatus("SEARCHING");
        await detectCurrentLocation();
      } else {
        preparePersonalTrailSimulation();
        if (!screenVisibleRef.current || switchGeneration !== locationGenerationRef.current) {
          resetPersonalTrailSimulation();
          return;
        }
        simulatedRef.current = true;
        setIsSimulated(true);
        const first = PERSONAL_TRAIL_SIMULATION.route.points[0];
        setCurrentPosition({ ...first, elevation: PERSONAL_TRAIL_SIMULATION.altitudeM });
        setGpsAccuracy(PERSONAL_TRAIL_SIMULATION.accuracyM);
        setTrailRegion(PERSONAL_TRAIL_SIMULATION.region);
        setGpsStatus("SIMULATED");
        mapRef.current?.centerOnUser(first.longitude, first.latitude, 16);
      }
    } catch (error) {
      resetPersonalTrailSimulation();
      simulatedRef.current = false;
      setIsSimulated(false);
      Alert.alert("Chưa bật được GPS giả lập", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      setIsSwitchingGps(false);
    }
  };

  const handleStart = async () => {
    if (isStarting || isSwitchingGps || recoveryPending.current || isRecordingRef.current || startPendingRef.current) return;
    startPendingRef.current = true;
    setIsStarting(true);
    let trackingStarted = false;
    try {
      const startedAt = new Date().toISOString();
      gpsProcessorRef.current.reset(Date.parse(startedAt));
      setGpsStatus("SEARCHING");
      replaceRecordedCoordinates([]);
      setDistanceKm(0);
      setElevationGainM(0);
      setCurrentSpeedKmh(0);
      setElapsedSeconds(0);
      setCheckpoints([]);

      // Khởi tạo phiên ghi mới trong SQLite
      const newRecId = generateUUID();
      currentRecordingIdRef.current = newRecId;
      await recordingDatabase.createRecording(newRecId, startedAt);
      await recordingDatabase.enqueueOutbox(newRecId, "CREATE_RECORDING", {
        startedAt,
      });
      syncService.processSyncOutbox().catch(console.warn);

      isPausedRef.current = false;
      isRecordingRef.current = true;
      setIsFollowingUser(true);

      const started = await startLocationTracking();
      if (!screenVisibleRef.current) { locationSubscription.current?.remove(); return; }
      if (!started) {
        if (simulatedRef.current) pausePersonalTrailSimulation();
        isRecordingRef.current = false;
        recordingDatabase.deleteRecording(newRecId).catch(console.warn);
        currentRecordingIdRef.current = null;
        Alert.alert(
          "Không thể ghi GPS",
          "Vui lòng kiểm tra quyền vị trí và dịch vụ định vị GPS.",
        );
        return;
      }

      trackingStarted = true;
      setIsRecording(true);
      setIsPaused(false);

      if (simulatedRef.current) return; // Simulation is foreground-only; no native background task.
      const backgroundPermission = await Location.getBackgroundPermissionsAsync();
      if (backgroundPermission.status === "granted") {
        await startBackgroundLocationUpdates().catch(console.warn);
      } else {
        Alert.alert(
          "Cho phép ghi khi tắt màn hình?",
          "TrekGo cần quyền vị trí nền để hành trình không bị ngắt khi bạn khóa màn hình hoặc chuyển ứng dụng.",
          [
            { text: "Chỉ ghi khi mở ứng dụng", style: "cancel" },
            {
              text: "Cho phép",
              onPress: () => {
                Location.requestBackgroundPermissionsAsync()
                  .then((permission) => {
                    if (permission.status === "granted") {
                      return startBackgroundLocationUpdates();
                    }
                    return false;
                  })
                  .catch(console.warn);
              },
            },
          ],
        );
      }
    } catch (error) {
      if (trackingStarted) {
        console.warn("[LiveTrailRecorder] Background setup failed:", error);
        return;
      }
      if (currentRecordingIdRef.current) {
        await recordingDatabase.deleteRecording(currentRecordingIdRef.current).catch(console.warn);
        currentRecordingIdRef.current = null;
      }
      locationSubscription.current?.remove();
      if (simulatedRef.current) pausePersonalTrailSimulation();
      isRecordingRef.current = false;
      setIsRecording(false);
      Alert.alert("Không thể bắt đầu ghi", error instanceof Error ? error.message : "Vui lòng thử lại.");
    } finally {
      startPendingRef.current = false;
      setIsStarting(false);
    }
  };

  // Khi người dùng chủ động chạm/vuốt/zoom bản đồ -> Tắt Follow Mode, cho phép tự do khám phá địa hình
  const handleUserMapInteraction = useCallback(() => {
    setIsFollowingUser(false);
  }, []);

  // Khi người dùng bấm nút La bàn trên bản đồ -> Bật lại Follow Mode
  const handleCompassPress = useCallback(() => {
    setIsFollowingUser(true);
  }, []);

  // Khi bấm nút Định vị tôi (trên status bar hoặc nút Locate trên map) -> Zoom cận cảnh vị trí hiện tại
  const handleCenterOnUser = useCallback(() => {
    setIsFollowingUser(true);
    if (currentPosition && mapRef.current) {
      mapRef.current.centerOnUser(
        currentPosition.longitude,
        currentPosition.latitude,
        16.5,
      );
    } else {
      detectCurrentLocation();
    }
  }, [currentPosition, detectCurrentLocation]);

  const handlePauseResume = async () => {
    if (operationLock.current || saveLock.current) return;
    operationLock.current = true;
    const id = currentRecordingIdRef.current;
    const nextPaused = !isPausedRef.current;
    isPausedRef.current = true; setIsPaused(true);
    try {
      if (!id) return;
      if (nextPaused) {
        if (simulatedRef.current) pausePersonalTrailSimulation();
        locationSubscription.current?.remove(); locationSubscription.current = null;
        if (!simulatedRef.current) await stopBackgroundLocationUpdates();
        await drainPersonalTrailWrites();
        blockPersonalTrailWrites(id);
      } else {
        await recordingDatabase.incrementSegmentId(id);
        gpsProcessorRef.current.breakSegment();
        allowPersonalTrailWrites(id);
      }
      await recordingDatabase.updateRecordingStatus(id, nextPaused ? "PAUSED" : "RECORDING");
      await recordingDatabase.enqueueOutbox(id, "UPDATE_STATUS", {
        status: nextPaused ? "PAUSED" : "RECORDING", timestamp: new Date().toISOString(),
      });
      if (!nextPaused) {
        if (!await startLocationTracking()) throw new Error("GPS tracking unavailable");
        if (!simulatedRef.current) await startBackgroundLocationUpdates();
        isPausedRef.current = false; setIsPaused(false);
        if (simulatedRef.current) resumePersonalTrailSimulation();
      }
      void syncService.processSyncOutbox().catch(console.warn);
    } catch (error) {
      if (id) {
        blockPersonalTrailWrites(id);
        await recordingDatabase.updateRecordingStatus(id, "PAUSED").catch(console.warn);
      }
      isPausedRef.current = true; setIsPaused(true);
      Alert.alert("Chưa thể tiếp tục ghi", String(error));
    }
    finally { operationLock.current = false; }
  };

  const pauseResumeHandlerRef = useRef(handlePauseResume);
  useEffect(() => { pauseResumeHandlerRef.current = handlePauseResume; });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active" && simulatedRef.current && isRecordingRef.current && !isPausedRef.current) {
        pauseResumeHandlerRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

  const handleStopAndSave = async () => {
    if (operationLock.current || saveLock.current) return;
    operationLock.current = true;
    try {
    isPausedRef.current = true; setIsPaused(true);
    locationSubscription.current?.remove();
    if (simulatedRef.current) pausePersonalTrailSimulation();
    const recId = currentRecordingIdRef.current;
    let coordinatesForSave = recordedCoordinatesRef.current;

    if (recId) {
      if (!simulatedRef.current) await stopBackgroundLocationUpdates().catch(console.warn);
      await drainPersonalTrailWrites();
      blockPersonalTrailWrites(recId);
      const persisted = await recordingDatabase.getAcceptedPoints(recId);
      coordinatesForSave = persisted.map((sample) => ({
        latitude: sample.latitude,
        longitude: sample.longitude,
        elevation: sample.altitudeM ?? undefined,
        timestamp: new Date(sample.recordedAt).getTime(),
        accuracy: sample.accuracyM ?? 10,
        altitudeAccuracy: sample.altitudeAccuracyM ?? undefined,
        speed: sample.speedMps ?? undefined,
        segmentId: sample.segmentId,
      }));
      replaceRecordedCoordinates(coordinatesForSave);

      let persistedDistanceM = 0;
      let persistedElevationM = 0;
      for (let index = 1; index < coordinatesForSave.length; index += 1) {
        const previous = coordinatesForSave[index - 1];
        const current = coordinatesForSave[index];
        if (previous.segmentId === current.segmentId) {
          persistedDistanceM += distanceMeters(previous, current);
          if (
            previous.elevation != null &&
            current.elevation != null &&
            current.elevation > previous.elevation
          ) {
            persistedElevationM += current.elevation - previous.elevation;
          }
        }
      }
      setDistanceKm(persistedDistanceM / 1000);
      setElevationGainM(Math.round(persistedElevationM));
    }

    // 1. Chặn ngay từ đầu nếu không đủ điều kiện tối thiểu:
    // Phải có ít nhất 2 điểm GPS và ít nhất một segment có từ 2 điểm trở lên.
    const segmentsMap = new Map<number, number>();
    for (const c of coordinatesForSave) {
      const segId = c.segmentId ?? 0;
      segmentsMap.set(segId, (segmentsMap.get(segId) ?? 0) + 1);
    }
    const hasValidSegment = Array.from(segmentsMap.values()).some(
      (count) => count >= 2,
    );

    if (coordinatesForSave.length < 2 || !hasValidSegment) {
      Alert.alert(
        "Đoạn đường quá ngắn",
        "Cung đường chưa đủ dữ liệu GPS (cần có ít nhất một đoạn từ 2 điểm GPS trở lên). Bạn cần di chuyển thêm để tạo cung đường.",
        [{ text: "Đã hiểu", style: "default" }],
      );
      return;
    }

    // Đạt điều kiện: Tạm dừng nhận điểm và mở form đặt tên cung đường
    locationSubscription.current?.remove();
    locationSubscription.current = null;

    isPausedRef.current = true;
    setIsPaused(true);

    if (recId) {
      recordingDatabase
        .updateRecordingStatus(recId, "PAUSED")
        .catch(console.warn);
    }

    setTrailName(`${simulatedRef.current ? "[GIẢ LẬP] " : ""}Cung đường ngày ${new Date().toLocaleDateString("vi-VN")}`);
    if (simulatedRef.current) pausePersonalTrailSimulation();
    endedAtRef.current = new Date().toISOString();
    setShowSaveForm(true);
    } catch (error) { Alert.alert("GPS", String(error)); }
    finally { operationLock.current = false; }
  };

  const handleConfirmSave = async () => {
    if (isSaving || saveLock.current) return;

    if (!trailName.trim()) {
      Alert.alert("Vui lòng nhập tên", "Hãy đặt tên cho cung đường của bạn.");
      return;
    }

    // Gom nhóm segment hợp lệ từ GPS thực tế (MultiLineString)
    const segmentsMap = new Map<number, [number, number, number?][]>();
    for (const c of recordedCoordinates) {
      const segId = c.segmentId ?? 0;
      if (!segmentsMap.has(segId)) {
        segmentsMap.set(segId, []);
      }
      segmentsMap
        .get(segId)!
        .push([
          c.longitude,
          c.latitude,
          c.elevation != null ? Math.round(c.elevation) : undefined,
        ]);
    }

    const validSegments = Array.from(segmentsMap.values()).filter(
      (seg) => seg.length >= 2,
    );

    // Chặn triệt để nếu không đủ dữ liệu GPS
    if (recordedCoordinates.length < 2 || validSegments.length === 0) {
      Alert.alert(
        "Đoạn đường quá ngắn",
        "Cung đường chưa đủ dữ liệu GPS (cần có ít nhất một đoạn từ 2 điểm GPS trở lên). Bạn cần di chuyển thêm để tạo cung đường.",
      );
      return;
    }

    saveLock.current = true;
    setIsSaving(true);

    try {
      const durationMin = Math.round(elapsedSeconds / 60);
      const durationStr =
        durationMin >= 60
          ? `${Math.floor(durationMin / 60)} giờ ${durationMin % 60} phút`
          : `${Math.max(1, durationMin)} phút`;

      const effectiveDistanceKm = Number(distanceKm.toFixed(3));
      const gpsSegments: [number, number, number?][][] = validSegments;

      const flatPoints: [number, number, number?][] = [];
      for (const seg of gpsSegments) {
        flatPoints.push(...seg);
      }
      const gpsRouteCoords: [number, number, number?][] = flatPoints;

      const recId = currentRecordingIdRef.current;
      const endedAt = endedAtRef.current || new Date().toISOString();
      // 2. Chuyển đổi sang format PersonalTrail của TrekGo
      const newTrail = await createPersonalTrail({
        endedAt,
        elapsedSeconds,
        name: simulatedRef.current && !trailName.trim().startsWith("[GIẢ LẬP]") ? `[GIẢ LẬP] ${trailName.trim()}` : trailName.trim(),
        region: trailRegion,
        difficulty: trailDifficulty,
        distanceKm: effectiveDistanceKm,
        elevationGainM: Math.round(elevationGainM),
        duration: durationStr,
        terrainType: "Rừng & Đồi dốc",
        description:
          (simulatedRef.current ? "[GPS GIẢ LẬP] " + (trailDescription.trim() || "Dữ liệu test personal trail, không phải hành trình thực tế.") : trailDescription.trim()) ||
          `Cung đường ghi nhận thực tế vào ngày ${new Date().toLocaleDateString("vi-VN")}`,
        submitForVerification: false,
        gpsRoute: gpsRouteCoords,
        gpsSegments: gpsSegments,
        clientRecordingId: recId || undefined,
        checkpoints: [],
      });

      void syncService.processSyncOutbox().catch(console.warn);

      // 4. Dọn dẹp session
      resetSession();
      setShowSaveForm(false);
      setIsSaving(false);
      onClose();
      onSaved?.(newTrail.id, newTrail);

      setTimeout(() => {
        Alert.alert(
          "Đã lưu cung đường trên thiết bị",
          `Cung đường "${newTrail.name}" (${effectiveDistanceKm} km) đã được lưu vào thiết bị của bạn.`,
        );
      }, 400);
    } catch (saveErr) {
      console.warn("[LiveTrailRecorder] Save error:", saveErr);
      Alert.alert(
        "Lưu cung đường thất bại",
        "Có lỗi khi lưu dữ liệu vào bộ nhớ máy. Vui lòng bấm lưu lại.",
      );
      setIsSaving(false);
    } finally { saveLock.current = false; }
  };

  const handleCancel = () => {
    if (operationLock.current || saveLock.current || startPendingRef.current) return;
    if (isRecording) {
      Alert.alert(
        "Hủy phiên ghi?",
        "Dữ liệu GPS của cung đường hiện tại chưa lưu sẽ bị mất.",
        [
          { text: "Tiếp tục ghi", style: "cancel" },
          {
            text: "Hủy bỏ",
            style: "destructive",
            onPress: async () => {
              if (!simulatedRef.current) await stopBackgroundLocationUpdates().catch(console.warn);
              if (currentRecordingIdRef.current) {
                await recordingDatabase
                  .deleteRecording(currentRecordingIdRef.current)
                  .catch(console.warn);
              }
              resetSession();
              onClose();
            },
          },
        ],
      );
    } else {
      resetSession();
      onClose();
    }
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Mảng toạ độ vẽ trên MapLibre: [lng, lat, elev?]
  // Memoize để tránh tạo reference mới trên mỗi nhịp giây (tránh re-render map liên tục)
  // Mảng phân đoạn toạ độ vẽ trên MapLibre: [lng, lat, elev?][][] (MultiLineString)
  // Tách biệt theo segmentId giúp không bị vẽ đường nối xuyên qua lúc Tạm dừng hoặc mất tín hiệu GPS
  const traveledRouteSegments: [number, number, number?][][] = useMemo(() => {
    if (recordedCoordinates.length === 0) return [];
    const segmentsMap = new Map<number, [number, number, number?][]>();
    for (const c of recordedCoordinates) {
      const segId = c.segmentId ?? 0;
      if (!segmentsMap.has(segId)) {
        segmentsMap.set(segId, []);
      }
      segmentsMap
        .get(segId)!
        .push([
          c.longitude,
          c.latitude,
          c.elevation != null ? Math.round(c.elevation) : undefined,
        ]);
    }
    return Array.from(segmentsMap.values()).filter((seg) => seg.length > 0);
  }, [recordedCoordinates]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* 1. Header HUD */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} disabled={isStarting || isSwitchingGps} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.recBadge}>
              <View
                style={[
                  styles.recDot,
                  isRecording && !isPaused && styles.recDotActive,
                ]}
              />
              <Text style={styles.recTitle}>
                {isRecording
                  ? isPaused
                    ? "ĐÃ TẠM DỪNG"
                    : "LIVE TREKGO TRACK"
                  : "CHUẨN BỊ GHI CUNG ĐƯỜNG"}
              </Text>
            </View>
          </View>
        </View>

        {__DEV__ && (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isRecording || isStarting || isSwitchingGps || showSaveForm}
            onPress={handleToggleSimulation}
            style={{ padding: 12, backgroundColor: isSimulated ? "#6b3c00" : "#163326", opacity: isRecording || isStarting || isSwitchingGps ? 0.5 : 1 }}
          >
            <Text style={{ color: "#fff", textAlign: "center" }}>
              {isSwitchingGps ? "Đang chuyển nguồn GPS..." : isSimulated ? "GPS GIẢ LẬP · Bấm để về GPS thật" : "Chuyển sang GPS giả lập"}
            </Text>
            <Text style={{ color: "#ddd", textAlign: "center", fontSize: 11 }}>
              {isRecording ? "Kết thúc phiên để đổi nguồn GPS" : "Chỉ personal trail · dữ liệu vẫn lưu/đồng bộ theo luồng hiện tại"}
            </Text>
          </TouchableOpacity>
        )}
        {/* GPS Tactical Status Bar */}
        <View style={styles.gpsStatusBar}>
          <TouchableOpacity
            style={styles.gpsStatusLeft}
            onPress={gpsStatus === "DENIED" ? detectCurrentLocation : undefined}
            activeOpacity={gpsStatus === "DENIED" ? 0.7 : 1}
          >
            <View
              style={[
                styles.gpsDot,
                gpsStatus === "READY" && styles.gpsDotReady,
                gpsStatus === "SEARCHING" && styles.gpsDotSearching,
                gpsStatus === "DENIED" && styles.gpsDotDenied,
                gpsStatus === "SIMULATED" && styles.gpsDotSimulated,
              ]}
            />
            <Text style={styles.gpsStatusText} numberOfLines={1}>
              {isSimulated ? "GPS GIẢ LẬP · " + PERSONAL_TRAIL_SIMULATION.route.name : gpsStatus === "READY" && currentPosition
                ? `GPS ${gpsAccuracy ? `(±${Math.round(gpsAccuracy)}m)` : ""} · ${currentPosition.latitude.toFixed(4)}°N, ${currentPosition.longitude.toFixed(4)}°E`
                : gpsStatus === "SEARCHING"
                  ? "Đang dò sóng vệ tinh GPS..."
                  : gpsStatus === "DENIED"
                    ? "Chưa cấp quyền GPS (Bấm cấp quyền)"
                    : "Vị trí mô phỏng " + PERSONAL_TRAIL_SIMULATION.route.name}
            </Text>
          </TouchableOpacity>

          <View style={styles.gpsActionsRight}>
            <TouchableOpacity
              style={[
                styles.gpsLocateBtn,
                isFollowingUser && isRecording && !isPaused
                  ? styles.gpsLocateBtnActive
                  : styles.gpsLocateBtnInactive,
              ]}
              onPress={handleCenterOnUser}
              activeOpacity={0.8}
            >
              <Ionicons
                name={
                  isFollowingUser && isRecording && !isPaused
                    ? "navigate"
                    : "locate"
                }
                size={13}
                color={
                  isFollowingUser && isRecording && !isPaused
                    ? "#0c2000"
                    : "#ffffff"
                }
              />
              <Text
                style={[
                  styles.gpsLocateText,
                  isFollowingUser && isRecording && !isPaused
                    ? styles.gpsLocateTextActive
                    : styles.gpsLocateTextInactive,
                ]}
              >
                {isFollowingUser && isRecording && !isPaused
                  ? "Bám GPS"
                  : "Định vị"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. MapLibre View (Mặc định 2D tĩnh trong lúc tracking để triệt tiêu biến dạng Terrain 3D) */}
        <View style={styles.mapContainer}>
          <MapLibre3DView
            ref={mapRef}
            center={
              currentPosition
                ? [currentPosition.longitude, currentPosition.latitude]
                : [108.529, 11.5831]
            }
            is3D={false}
            pitch={0}
            dragRotate={true}
            autoCenterOnUser={true}
            followUser={isFollowingUser && isRecording && !isPaused}
            onUserInteraction={handleUserMapInteraction}
            onCompassPress={handleCompassPress}
            onLocatePress={handleCenterOnUser}
            traveledRoute={traveledRouteSegments}
            currentPosition={currentPosition}
            checkpoints={checkpoints}
            interactive={true}
          />
        </View>

        {/* 3. Compact Telemetry Dashboard */}
        <View style={styles.dashboard}>
          {/* Row 1: Primary Stats (Thời gian di chuyển & Quãng đường) */}
          <View style={styles.primaryStatsRow}>
            <View style={styles.primaryStatBox}>
              <Text style={styles.compactMetricLabel}>THỜI GIAN</Text>
              <Text style={styles.primaryStatValue}>
                {formatTime(elapsedSeconds)}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.primaryStatBox}>
              <Text style={styles.compactMetricLabel}>QUÃNG ĐƯỜNG</Text>
              <View style={styles.primaryValueWithUnit}>
                <Text style={styles.primaryStatValue}>
                  {distanceKm.toFixed(2)}
                </Text>
                <Text style={styles.primaryStatUnit}>km</Text>
              </View>
            </View>
          </View>

          {/* Row 2: Secondary Stats (Tốc độ, Độ cao lũy kế, Nhịp độ) */}
          <View style={styles.secondaryStatsRow}>
            <View style={styles.secondaryStatBox}>
              <Text style={styles.compactSubLabel}>TỐC ĐỘ</Text>
              <Text style={styles.secondaryStatValue}>
                {currentSpeedKmh.toFixed(1)}{" "}
                <Text style={styles.secondaryStatUnit}>km/h</Text>
              </Text>
            </View>

            <View style={styles.secondaryStatBox}>
              <Text style={styles.compactSubLabel}>ĐỘ CAO +</Text>
              <Text style={styles.secondaryStatValue}>
                +{elevationGainM}{" "}
                <Text style={styles.secondaryStatUnit}>m</Text>
              </Text>
            </View>

            <View style={styles.secondaryStatBox}>
              <Text style={styles.compactSubLabel}>NHỊP ĐỘ</Text>
              <Text style={styles.secondaryStatValue}>
                {averagePace}{" "}
                <Text style={styles.secondaryStatUnit}>/km</Text>
              </Text>
            </View>
          </View>

          {/* Current GPS Coordinates & Real Elevation Info Subline */}
          {/* <View style={styles.gpsCoordCard}>
            <Ionicons name="navigate-circle" size={13} color={Colors.primary} />
            <Text style={styles.gpsCoordText} numberOfLines={1}>
              {currentPosition
                ? `Vị trí: ${currentPosition.latitude.toFixed(4)}°B, ${currentPosition.longitude.toFixed(4)}°Đ · Cao: ${currentPosition.elevation != null ? `${Math.round(currentPosition.elevation)}m` : "--"}`
                : "Đang kết nối tín hiệu vệ tinh GPS..."}
            </Text>
          </View> */}
        </View>

        {/* 4. Controls Footer */}
        <View style={styles.footer}>
          {!isRecording ? (
            <TouchableOpacity
              style={styles.startButton}
              disabled={isStarting || isSwitchingGps}
              onPress={handleStart}
              activeOpacity={0.85}
            >
              <Ionicons name="play" size={22} color="#0c2000" />
              <Text style={styles.startButtonText}>BẮT ĐẦU GHI CUNG ĐƯỜNG</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.activeControlsRow}>
              {/* Pause / Resume Button */}
              <TouchableOpacity
                style={[
                  styles.pauseResumeBtn,
                  isPaused ? styles.resumeBtn : styles.pauseBtn,
                ]}
                onPress={handlePauseResume}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={isPaused ? "play" : "pause"}
                  size={20}
                  color={isPaused ? "#0c2000" : "#ffffff"}
                />
                <Text
                  style={[
                    styles.pauseResumeText,
                    { color: isPaused ? "#0c2000" : "#ffffff" },
                  ]}
                >
                  {isPaused ? "Tiếp tục" : "Tạm dừng"}
                </Text>
              </TouchableOpacity>

              {/* Stop & Save Button */}
              <TouchableOpacity
                style={styles.finishActionBtn}
                onPress={handleStopAndSave}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-done" size={20} color="#ffffff" />
                <Text style={styles.finishActionText}>Hoàn tất</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 5. Save Trail Info Overlay (View overlay thay vì nested Modal để không bị màn hình đen trên iOS) */}
        {showSaveForm && (
          <View style={styles.saveModalBackdrop}>
            <View style={styles.saveModalCard}>
              <Text style={styles.saveModalTitle}>Lưu Cung Đường Cá Nhân</Text>
              <Text style={styles.saveModalSubtitle}>
                {distanceKm} km · {formatTime(elapsedSeconds)} · +
                {elevationGainM}m độ cao
              </Text>

              <ScrollView
                style={{ maxHeight: 280 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>TÊN CUNG ĐƯỜNG</Text>
                <TextInput
                  style={styles.textInput}
                  value={trailName}
                  onChangeText={setTrailName}
                  placeholder="Ví dụ: Đường mòn săn mây đỉnh 986m"
                  placeholderTextColor="#777"
                />

                <Text style={styles.inputLabel}>KHU VỰC / TỈNH THÀNH</Text>
                <TextInput
                  style={styles.textInput}
                  value={trailRegion}
                  onChangeText={setTrailRegion}
                  placeholder="Ví dụ: Lâm Đồng"
                  placeholderTextColor="#777"
                />

                <Text style={styles.inputLabel}>MÔ TẢ NGẮN</Text>
                <TextInput
                  style={[styles.textInput, { height: 60 }]}
                  value={trailDescription}
                  onChangeText={setTrailDescription}
                  placeholder="Ghi chú về nguồn nước, độ dốc, lều trại..."
                  placeholderTextColor="#777"
                  multiline
                />
              </ScrollView>

              <View style={styles.saveModalActions}>
                <TouchableOpacity
                  style={styles.saveCancelBtn}
                  onPress={() => {
                    setShowSaveForm(false);
                    // Stay paused until Continue restores tracking.
                  }}
                  disabled={isSaving}
                >
                  <Text style={styles.saveCancelText}>Quay lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveSubmitBtn, isSaving && { opacity: 0.6 }]}
                  onPress={handleConfirmSave}
                  disabled={isSaving}
                >
                  <Text style={styles.saveSubmitText}>
                    {isSaving ? "Đang lưu..." : "Lưu & Đồng bộ"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#081008",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0d150c",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: "rgba(20, 25, 18, 0.8)",
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#666",
  },
  recDotActive: {
    backgroundColor: "#ff3b30",
  },
  recTitle: {
    color: "#e4e2dd",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  simStepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 239, 125, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  simStepText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "800",
  },
  mapContainer: {
    flex: 1,
    width: "100%",
  },
  gpsStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#0d170d",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.07)",
    gap: 8,
  },
  gpsStatusLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#888",
  },
  gpsDotReady: {
    backgroundColor: "#38ef7d",
  },
  gpsDotSearching: {
    backgroundColor: "#fed018",
  },
  gpsDotDenied: {
    backgroundColor: "#ff3b30",
  },
  gpsDotSimulated: {
    backgroundColor: "#4cc9f0",
  },
  gpsStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#c2d1be",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  gpsActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gpsActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(159, 232, 112, 0.3)",
  },
  gpsActionPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  gpsActionPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9fe870",
  },
  gpsActionPillTextActive: {
    color: "#0c2000",
  },
  gpsLocateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  gpsLocateBtnActive: {
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  gpsLocateBtnInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  gpsLocateText: {
    fontSize: 10,
    fontWeight: "800",
  },
  gpsLocateTextActive: {
    color: "#0c2000",
  },
  gpsLocateTextInactive: {
    color: "#ffffff",
  },
  gpsCoordCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(20, 25, 18, 0.5)",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(56, 239, 125, 0.18)",
  },
  gpsCoordText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9fe870",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    flex: 1,
  },
  dashboard: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#0d150c",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  primaryStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 25, 18, 0.7)",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  primaryStatBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  compactMetricLabel: {
    fontSize: 9,
    color: "#9fe870",
    fontWeight: "800",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  primaryStatValue: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
    fontFamily: Platform.OS === "ios" ? "Helvetica Neue" : "monospace",
    letterSpacing: 0.5,
  },
  primaryValueWithUnit: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  primaryStatUnit: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8a9486",
  },
  secondaryStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 8,
  },
  secondaryStatBox: {
    flex: 1,
    backgroundColor: "rgba(20, 25, 18, 0.5)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
  },
  compactSubLabel: {
    fontSize: 8,
    color: "#8a9486",
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  secondaryStatValue: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  secondaryStatUnit: {
    fontSize: 9,
    fontWeight: "700",
    color: "#8a9486",
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    backgroundColor: "#0d150c",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  startButton: {
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Shadows.hover,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0c2000",
    letterSpacing: 0.5,
  },
  activeControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pauseResumeBtn: {
    flex: 1,
    height: 50,
    borderRadius: Radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...Shadows.tactical,
  },
  pauseBtn: {
    backgroundColor: "#ba1a1a",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  resumeBtn: {
    backgroundColor: Colors.primary,
  },
  pauseResumeText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  finishActionBtn: {
    flex: 1,
    height: 50,
    borderRadius: Radius.full,
    backgroundColor: "#1b4d24",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#38ef7d",
  },
  finishActionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  saveModalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    justifyContent: "center",
    padding: 20,
    zIndex: 999,
  },
  saveModalCard: {
    backgroundColor: "#141e13",
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(159, 232, 112, 0.25)",
    ...Shadows.card,
  },
  saveModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
  },
  saveModalSubtitle: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9fe870",
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: "#0d150c",
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  saveModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  saveCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveCancelText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  saveSubmitBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveSubmitText: {
    color: "#0c2000",
    fontSize: 13,
    fontWeight: "900",
  },
});
