import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api-client';
import { generateUUID } from '@/services/storage/recordingDatabase';
import { GpsProcessor } from '@/utils/gpsProcessor';
import { snapToRoute } from '@/utils/mapMatching';
import { TripGpsSimulator } from '@/services/location/tripGpsSimulator';
import {
  finishGpsSession,
  getGpsContext,
  getGpsSession,
  getGpsState,
  getMyActualRoute,
  getMyLiveRoute,
  pauseGpsSession,
  resumeGpsSession,
  startGpsSession,
  uploadGpsSamples,
} from '../services/trip-gps.api';
import { tripGpsSocket } from '../services/trip-gps.socket';
import {
  getActiveTripSession,
  getOrCreateDeviceId,
  getPendingCommands,
  getPendingSamples,
  getLatestSessionSampleTime,
  getTripSessionsWithPendingSamples,
  getSessionCoordinates,
  insertGpsSample,
  markCommandSynced,
  markSamplesAccepted,
  markSamplesRejected,
  pruneCompletedSessionSamples,
  pruneSyncedCommands,
  saveLocalTripSession,
  updateLocalSessionStatus,
} from '../services/trip-gps.storage';
import type {
  ActualRouteResponse,
  GpsContextResponse,
  GpsPolicyDto,
  GpsSample,
  GpsStateResponse,
  MemberStateDto,
  SamplesRequest,
  SessionDto,
  TripCheckpointDto,
} from '../types';

/** A REST snapshot must never replace a member state received at a newer Socket.IO version. */
function mergeGpsState(current: GpsStateResponse | null, incoming: GpsStateResponse): GpsStateResponse {
  if (!current || current.tripId !== incoming.tripId) return incoming;

  const currentByUserId = new Map(current.members.map((member) => [member.userId, member]));
  const incomingUserIds = new Set(incoming.members.map((member) => member.userId));
  const members = incoming.members.map((member) => {
    const existing = currentByUserId.get(member.userId);
    return existing && existing.memberVersion > member.memberVersion ? existing : member;
  });

  // Do not let an older roster snapshot remove a member already displayed on the map.
  if (current.rosterVersion > incoming.rosterVersion) {
    members.push(...current.members.filter((member) => !incomingUserIds.has(member.userId)));
  }

  return { ...incoming, rosterVersion: Math.max(current.rosterVersion, incoming.rosterVersion), members };
}

export function useTripGps(tripId?: string) {
  const { accessToken, isLoading: authLoading } = useAuth();

  const [context, setContext] = useState<GpsContextResponse | null>(null);
  const [gpsState, setGpsState] = useState<GpsStateResponse | null>(null);
  const [session, setSession] = useState<SessionDto | null>(null);
  const [policy, setPolicy] = useState<GpsPolicyDto | null>(null);
  const [actualRoute, setActualRoute] = useState<ActualRouteResponse | null>(null);
  const [liveRouteCoords, setLiveRouteCoords] = useState<[number, number][]>([]);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracyM: number;
    altitudeM: number | null;
    speedMps: number | null;
    headingDeg: number | null;
  } | null>(null);

  // Chế độ mô phỏng Fake GPS & Map matching
  const [isSimulated, setIsSimulated] = useState(false);
  const [isMapMatchingEnabled, setIsMapMatchingEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const locationSubscriptionRef = useRef<Location.LocationSubscription | { remove: () => void } | null>(null);
  const syncTimerRef = useRef<any>(null);
  const pollTimerRef = useRef<any>(null);
  const isSyncingRef = useRef(false);
  const isFinishingRef = useRef(false);
  const sampleWritesRef = useRef(new Set<Promise<void>>());
  const syncIdleWaitersRef = useRef<Array<() => void>>([]);
  const [trackingRevision, setTrackingRevision] = useState(0);
  const syncPendingRef = useRef(false);
  const gpsProcessorRef = useRef<GpsProcessor>(new GpsProcessor());
  const simulatorRef = useRef<TripGpsSimulator | null>(null);

  const immediateSyncNeededRef = useRef(false);
  const gpsStateRef = useRef<GpsStateResponse | null>(null);
  const sessionRef = useRef<SessionDto | null>(session);
  sessionRef.current = session;
  const policyRef = useRef<GpsPolicyDto | null>(policy);
  policyRef.current = policy;
  const selfUserIdRef = useRef<string | undefined>(gpsState?.selfUserId);
  selfUserIdRef.current = gpsState?.selfUserId;
  const processOutboxSyncRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Local Stopwatch & Accumulated Duration (bù trừ lệch giờ giữa thiết bị và server)
  const accumulatedDurationMsRef = useRef<number>(0);
  const localSegmentStartMsRef = useRef<number | null>(null);
  const finishedClockRef = useRef<{ sessionId: string; stoppedAt: number; durationMs: number } | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());

  const syncLocalDurationFromSession = useCallback((sess: SessionDto | null) => {
    const frozen = finishedClockRef.current;
    if (sess && frozen?.sessionId === sess.id && (isFinishingRef.current || sess.status === 'STOPPED')) {
      accumulatedDurationMsRef.current = frozen.durationMs;
      localSegmentStartMsRef.current = null;
      return;
    }
    if (!sess) {
      accumulatedDurationMsRef.current = 0;
      localSegmentStartMsRef.current = null;
      return;
    }

    const intervals = sess.recordingIntervals;
    if (intervals && intervals.length > 0) {
      // 1. Tính tổng thời gian của các khoảng đã đóng (đã Pause trước đó)
      const closedMs = intervals
        .filter((i) => i.end != null)
        .reduce((sum, i) => sum + Math.max(0, Date.parse(i.end!) - Date.parse(i.start)), 0);

      accumulatedDurationMsRef.current = closedMs;

      // 2. Nếu phiên đang ACTIVE, xác định khoảng đang chạy
      if (sess.status === 'ACTIVE') {
        const ongoing = intervals.find((i) => !i.end);
        const ongoingStart = ongoing ? Date.parse(ongoing.start) : Date.parse(sess.startedAt);
        // Nếu thiết bị chưa có localSegmentStart (ví dụ vừa mở lại app), khởi tạo từ ongoingStart
        if (localSegmentStartMsRef.current == null) {
          const elapsedOngoing = Math.max(0, Date.now() - ongoingStart);
          localSegmentStartMsRef.current = Date.now() - elapsedOngoing;
        }
      } else {
        localSegmentStartMsRef.current = null;
      }
    } else {
      // Fallback khi chưa có intervals từ server
      if (sess.status === 'ACTIVE') {
        if (localSegmentStartMsRef.current == null) {
          const elapsed = sess.startedAt ? Math.max(0, Date.now() - Date.parse(sess.startedAt)) : 0;
          localSegmentStartMsRef.current = Date.now() - elapsed;
        }
      } else {
        localSegmentStartMsRef.current = null;
        if (sess.endedAt && sess.startedAt) {
          accumulatedDurationMsRef.current = Math.max(0, Date.parse(sess.endedAt) - Date.parse(sess.startedAt));
        }
      }
    }
  }, []);

  useEffect(() => {
    syncLocalDurationFromSession(session);
  }, [session, syncLocalDurationFromSession]);

  const applyGpsState = useCallback((incoming: GpsStateResponse) => {
    const next = mergeGpsState(gpsStateRef.current, incoming);
    gpsStateRef.current = next;
    setGpsState(next);
  }, []);

  const canViewGps = Boolean(accessToken && context?.tripId === tripId && context?.permissions.canViewGroupLocations);

  // Tuyến kế hoạch (Planned Route Geometry)
  const plannedRouteCoords = useMemo<[number, number][]>(() => {
    if (!context || !context.routePlans || context.routePlans.length === 0) return [];
    const activePlan =
      context.routePlans.find((p) => p.trailPlanId === context.activeTrailPlanId) ||
      context.routePlans[0];
    if (!activePlan?.geometry) return [];
    if (activePlan.geometry.type === 'LineString') {
      return activePlan.geometry.coordinates as [number, number][];
    }
    if (activePlan.geometry.type === 'MultiLineString') {
      return (activePlan.geometry.coordinates as [number, number][][]).flat() as [number, number][];
    }
    return [];
  }, [context]);

  // Cập nhật route cho Simulator khi plannedRouteCoords thay đổi
  useEffect(() => {
    if (simulatorRef.current && plannedRouteCoords.length > 0) {
      simulatorRef.current.updateRoute(plannedRouteCoords);
    }
  }, [plannedRouteCoords]);

  // 1. Tải Context và Khôi phục Session từ SQLite
  const loadContextAndActiveSession = useCallback(async () => {
    if (authLoading) return;
    if (!tripId) {
      setError('Thiếu mã chuyến đi. Vui lòng mở GPS từ chi tiết chuyến đi.');
      setLoading(false);
      return;
    }
    if (!accessToken) {
      setError('Vui lòng đăng nhập để sử dụng GPS chuyến đi.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setContext(null);
      gpsStateRef.current = null;
      setGpsState(null);

      // Tải Context từ server
      const ctx = await getGpsContext(tripId);
      setContext(ctx);
      setPolicy(ctx.policy);

      // Khôi phục Session đang hoạt động từ SQLite
      const localActive = await getActiveTripSession(tripId);
      if (localActive) {
        const remote = await getGpsSession(tripId, localActive.session.id, await getOrCreateDeviceId());
        localActive.session = remote.session;
        localActive.policy = remote.policy;
        await saveLocalTripSession(remote.session, remote.policy);
        setSession(localActive.session);
        setPolicy(localActive.policy);
        gpsProcessorRef.current.reset(Date.parse(localActive.session.startedAt));
        const coords = await getSessionCoordinates(localActive.session.id);
        setLiveRouteCoords(coords);
      }

      // Tải State hiện hành của cả đoàn
      const st = await getGpsState(tripId);
      applyGpsState(st);

      // Tìm session của bản thân trong state nếu local chưa có
      if (!localActive && st.selfUserId) {
        const selfMember = st.members.find((m) => m.userId === st.selfUserId);
        if (selfMember?.session) {
          const deviceId = await getOrCreateDeviceId();
          const restored = await getGpsSession(tripId, selfMember.session.id, deviceId);
          if (restored.session.deviceId !== deviceId) throw new Error('GPS session belongs to another device.');
          const reconstructedSession = restored.session;
          setSession(reconstructedSession);
          gpsProcessorRef.current.reset(Date.parse(reconstructedSession.startedAt));
          await saveLocalTripSession(reconstructedSession, restored.policy);
        }
      }
    } catch (err: any) {
      console.warn('[useTripGps] Failed to load GPS context/state:', {
        tripId,
        status: err instanceof ApiError ? err.status : undefined,
        code: err instanceof ApiError ? err.code : undefined,
        message: err?.message,
      });
      setContext(null);
      gpsStateRef.current = null;
      setGpsState(null);
      setError(err instanceof ApiError && err.code === 'GPS_TEMPORARILY_UNAVAILABLE'
        ? err.message === 'An effective GPS policy is required'
          ? 'Máy chủ chưa có cấu hình GPS đang có hiệu lực. Vui lòng liên hệ quản trị viên để thiết lập GPS policy.'
          : 'Dịch vụ GPS tạm thời chưa sẵn sàng. Vui lòng thử lại sau.'
        : err instanceof ApiError && err.status === 403
        ? 'Máy chủ từ chối quyền GPS chuyến đi này. Tài khoản cần là thành viên hợp lệ hoặc leader được phân công; chỉ đặt vé hộ chưa đủ quyền GPS.'
        : err?.message || 'Không thể tải thông tin GPS chuyến đi.');
    } finally {
      setLoading(false);
    }
  }, [tripId, accessToken, authLoading, applyGpsState]);

  useEffect(() => {
    loadContextAndActiveSession();
  }, [loadContextAndActiveSession]);

  // Khởi tạo vị trí ban đầu tại điểm đầu cung đường (vạch xuất phát) khi tải xong context
  useEffect(() => {
    if (!currentLocation && plannedRouteCoords.length > 0) {
      const [startLng, startLat] = plannedRouteCoords[0];
      setCurrentLocation({
        latitude: startLat,
        longitude: startLng,
        accuracyM: 5,
        altitudeM: 1200,
        speedMps: 0,
        headingDeg: 0,
      });
    }
  }, [plannedRouteCoords, currentLocation]);

  // 2. Kết nối Socket.IO Realtime
  useEffect(() => {
    if (!tripId || !accessToken || !canViewGps) return;

    tripGpsSocket.connect(accessToken, tripId, {
      onConnect: () => {
        // A namespace connection is not yet a room subscription.
        setSocketConnected(false);
      },
      onSubscribed: () => {
        setSocketConnected(true);
        getGpsState(tripId).then(applyGpsState).catch(() => {});
      },
      onDisconnect: () => setSocketConnected(false),
      onError: (err) => console.warn('[useTripGps] Socket error:', err?.message || err),
      onMemberUpdated: (event) => {
        const updatedMember = event.data?.member;
        if (!updatedMember) return;
        const previous = gpsStateRef.current;
        if (!previous) {
          getGpsState(tripId).then(applyGpsState).catch(() => {});
          return;
        }
        const exists = previous.members.some((m) => m.userId === updatedMember.userId);
          const newMembers = exists
            ? previous.members.map((m) =>
                m.userId === updatedMember.userId && (updatedMember.memberVersion ?? 0) >= (m.memberVersion ?? 0)
                  ? { ...m, ...updatedMember }
                  : m
              )
            : [...previous.members, updatedMember];
        const next = { ...previous, members: newMembers };
        gpsStateRef.current = next;
        setGpsState(next);
      },
      onTripChanged: () => {
        if (tripId) {
          getGpsState(tripId).then(applyGpsState).catch(() => {});
          getGpsContext(tripId).then(setContext).catch(() => {});
        }
      },
      onRouteReady: (event) => {
        if (tripId && event.data.userId === selfUserIdRef.current) {
          getMyActualRoute(tripId).then(setActualRoute).catch(() => {});
        }
      },
      onAccessRevoked: () => {
        setError('Quyền truy cập GPS của bạn trong chuyến này đã bị thu hồi.');
      },
    });

    return () => {
      tripGpsSocket.disconnect();
      setSocketConnected(false);
    };
  }, [tripId, accessToken, canViewGps, applyGpsState]);

  useEffect(() => {
    if (!tripId || !context || ['OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS'].includes(context.tripStatus)) return;
    if (session && session.status !== 'STOPPED') {
      getGpsSession(tripId, session.id, session.deviceId).then(async (res) => {
        setSession(res.session);
        await saveLocalTripSession(res.session, res.policy);
      }).catch(() => {});
    }
  }, [tripId, context?.tripStatus, session?.id]);

  // 3. Polling Fallback (Mỗi 20s đối soát lại State cả đoàn khi ở màn hình)
  useEffect(() => {
    if (!tripId || !canViewGps) return;
    pollTimerRef.current = setInterval(async () => {
      try {
        setContext(await getGpsContext(tripId));
        const freshState = await getGpsState(tripId);
        applyGpsState(freshState);
      } catch {
        // Silent catch for background poll
      }
    }, 20000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [tripId, canViewGps, applyGpsState]);

  // 4. Theo dõi GPS Thiết bị hoặc Fake GPS khi Session đang ACTIVE
  useEffect(() => {
    let isCancelled = false;

    async function startLocationTracking() {
      if (isFinishingRef.current || session?.status !== 'ACTIVE' || !context?.permissions.canRecord) {
        if (locationSubscriptionRef.current) {
          locationSubscriptionRef.current.remove();
          locationSubscriptionRef.current = null;
        }
        if (simulatorRef.current) {
          simulatorRef.current.stop();
        }
        return;
      }

      // Handler xử lý mẫu tọa độ (áp dụng Map Matching và GpsProcessor)
      const handleLocationSample = async (loc: Location.LocationObject) => {
        if (isCancelled || isFinishingRef.current || !session) return;

        const accuracy = loc.coords.accuracy ?? 10;
        const maxAcc = policy?.maxAcceptedAccuracyM || 50;
        if (accuracy > maxAcc && !isSimulated) return;

        let lat = loc.coords.latitude;
        let lng = loc.coords.longitude;
        let alt = loc.coords.altitude ?? null;
        let heading = loc.coords.heading ?? null;

        // a. Áp dụng Map Matching (Snap to Route): hút vào tim đường kế hoạch
        if (isMapMatchingEnabled && plannedRouteCoords.length >= 2) {
          const snapThreshold = policy?.deviationThresholdM ? Number(policy.deviationThresholdM) : 35;
          const snapped = snapToRoute(
            { latitude: lat, longitude: lng, elevation: alt },
            plannedRouteCoords,
            snapThreshold
          );
          if (snapped.snapped) {
            lat = snapped.latitude;
            lng = snapped.longitude;
            if (snapped.bearingDeg != null) heading = snapped.bearingDeg;
          }
        }

        // b. Đi qua GpsProcessor (lọc nhiễu, tính lũy kế distance, độ cao mượt)
        const procResult = gpsProcessorRef.current.process({
          coords: {
            latitude: lat,
            longitude: lng,
            accuracy,
            altitude: alt != null ? alt : null,
            altitudeAccuracy: loc.coords.altitudeAccuracy ?? null,
            speed: loc.coords.speed ?? 0,
            heading: heading != null ? heading : null,
          },
          timestamp: loc.timestamp,
        });

        if (!procResult.accepted && !isSimulated) return;

        const effectiveSpeed = procResult.speedKmh > 0 ? procResult.speedKmh / 3.6 : (loc.coords.speed ?? 0);

        const sample: GpsSample = {
          clientSampleId: generateUUID(),
          recordedAt: new Date(loc.timestamp).toISOString(),
          latitude: lat,
          longitude: lng,
          accuracyM: accuracy,
          altitudeM: alt ?? null,
          speedMps: effectiveSpeed,
          headingDeg: heading ?? null,
        };

        // Lưu tức thì vào SQLite
        const write = insertGpsSample(session.id, sample);
        sampleWritesRef.current.add(write);
        try {
          await write;
        } finally {
          sampleWritesRef.current.delete(write);
        }

        setCurrentLocation({
          latitude: lat,
          longitude: lng,
          accuracyM: accuracy,
          altitudeM: alt ?? null,
          speedMps: effectiveSpeed,
          headingDeg: heading ?? null,
        });

        setLiveRouteCoords((prev) => [...prev, [sample.longitude, sample.latitude]]);

        // Tải lên ngay lập tức mẫu tọa độ đầu tiên của phiên ghi (thay vì đợi hết 10s timer)
        if (immediateSyncNeededRef.current) {
          immediateSyncNeededRef.current = false;
          processOutboxSyncRef.current?.();
        }
      };

      try {
        if (isSimulated) {
          if (!simulatorRef.current) {
            simulatorRef.current = new TripGpsSimulator({
              routeCoords: plannedRouteCoords,
              speedMps: 3.0,
              intervalMs: Math.max(1000, (policy?.sampleIntervalSeconds || 3) * 1000),
            });
          } else {
            simulatorRef.current.updateRoute(plannedRouteCoords);
          }
          locationSubscriptionRef.current = simulatorRef.current.start(
            handleLocationSample,
            false
          );
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (isCancelled || isFinishingRef.current) return;
          if (status !== 'granted') {
            setError('Cần cấp quyền truy cập vị trí để ghi lộ trình trekking.');
            return;
          }

          const intervalSec = policy?.sampleIntervalSeconds || 5;

          const subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: intervalSec * 1000,
              distanceInterval: 3,
            },
            handleLocationSample
          );
          if (isCancelled || isFinishingRef.current) subscription.remove();
          else locationSubscriptionRef.current = subscription;
        }
      } catch (err: any) {
        console.warn('[useTripGps] Location tracking error:', err?.message || err);
      }
    }

    startLocationTracking();

    return () => {
      isCancelled = true;
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
      if (simulatorRef.current) {
        simulatorRef.current.stop();
      }
    };
  }, [context?.permissions.canRecord, session?.status, session?.id, policy, isSimulated, isMapMatchingEnabled, plannedRouteCoords, trackingRevision]);

  // 5. Chu kỳ Đồng bộ SQLite -> Backend (Mỗi syncIntervalSeconds)
  const processOutboxSync = useCallback(async () => {
    if (isFinishingRef.current) return;
    const curSession = sessionRef.current;
    if (!tripId || !curSession) return;
    if (isSyncingRef.current) {
      syncPendingRef.current = true;
      return;
    }
    isSyncingRef.current = true;
    setSyncing(true);

    try {
      const deviceId = await getOrCreateDeviceId();

      // a. Xử lý các lệnh Pending (Pause, Resume, Finish)
      const pendingCmds = await getPendingCommands(curSession.id);
      for (const cmd of pendingCmds) {
        try {
          if (cmd.action === 'PAUSE') {
            await pauseGpsSession(tripId, curSession.id, {
              commandId: cmd.commandId,
              expectedVersion: cmd.expectedVersion,
              occurredAt: cmd.occurredAt,
            }, deviceId);
          } else if (cmd.action === 'RESUME') {
            await resumeGpsSession(tripId, curSession.id, {
              commandId: cmd.commandId,
              expectedVersion: cmd.expectedVersion,
              occurredAt: cmd.occurredAt,
            }, deviceId);
          } else if (cmd.action === 'FINISH') {
            await finishGpsSession(tripId, curSession.id, {
              commandId: cmd.commandId,
              expectedVersion: cmd.expectedVersion,
              occurredAt: cmd.occurredAt,
              reason: 'USER_FINISHED',
            }, deviceId);
          }
          await markCommandSynced(cmd.commandId);
        } catch (cmdErr: any) {
          console.warn('[useTripGps] Command sync failed:', cmd.action, cmdErr?.message);
        }
      }

      // b. Xử lý upload các điểm GPS theo batch
      const maxBatch = policyRef.current?.maxBatchSamples || 100;
      let hasUploadedAny = false;
      for (const pendingSessionId of await getTripSessionsWithPendingSamples(tripId)) {
        try {
          const pendingSamples = await getPendingSamples(pendingSessionId, maxBatch);
          if (pendingSamples.length > 0) {
            const uploadPayload: SamplesRequest = {
              samples: pendingSamples.map((s) => ({
                clientSampleId: s.clientSampleId.toLowerCase(),
                recordedAt: new Date(s.recordedAt).toISOString(),
                latitude: Number(s.latitude),
                longitude: Number(s.longitude),
                accuracyM: Math.max(0, Number(s.accuracyM)),
                altitudeM: s.altitudeM != null ? Number(s.altitudeM) : null,
                speedMps: s.speedMps != null ? Math.max(0, Number(s.speedMps)) : null,
                headingDeg:
                  s.headingDeg != null
                    ? Math.min(359.99, Math.max(0, ((Number(s.headingDeg) % 360) + 360) % 360))
                    : null,
              })),
            };

            const res = await uploadGpsSamples(tripId, pendingSessionId, uploadPayload, deviceId);
            await markSamplesAccepted(pendingSessionId, [...res.acceptedSampleIds, ...res.duplicateSampleIds]);
            if (res.rejectedSamples?.length) {
              await markSamplesRejected(pendingSessionId, res.rejectedSamples);
            }

            if (pendingSessionId === curSession.id && res.totalDistanceMeters != null) {
              setSession((prev) => (prev ? { ...prev, totalDistanceMeters: res.totalDistanceMeters, sampleCount: res.sampleCount } : prev));
            }
            hasUploadedAny = true;
          }
        } catch (err) {
          // An expired old session must not block uploads from the new recording.
          console.warn('[useTripGps] Session sample sync failed:', pendingSessionId, err);
        }
      }
      await pruneSyncedCommands(curSession.id);

      // Nếu vừa tải lên thành công, cập nhật ngay gpsState để có vị trí mới nhất của toàn đoàn
      if (hasUploadedAny) {
        getGpsState(tripId).then(applyGpsState).catch(() => {});
      }
    } catch (err: any) {
      console.warn('[useTripGps] Outbox sync error:', err?.message || err);
    } finally {
      isSyncingRef.current = false;
      syncIdleWaitersRef.current.splice(0).forEach((resolve) => resolve());
      setSyncing(false);
      if (syncPendingRef.current) {
        syncPendingRef.current = false;
        void processOutboxSyncRef.current();
      }
    }
  }, [tripId, applyGpsState]);

  processOutboxSyncRef.current = processOutboxSync;

  useEffect(() => {
    const syncSec = policy?.syncIntervalSeconds || 10;
    syncTimerRef.current = setInterval(processOutboxSync, syncSec * 1000);
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [processOutboxSync, policy]);

  // 6. Thao tác điều khiển phiên (Start, Pause, Resume, Finish)
  const startRecording = useCallback(async () => {
    if (isFinishingRef.current) return;
    if (!tripId || !canViewGps || !context?.permissions.canRecord) {
      setError(context?.permissions.cannotRecordReason || 'Chưa đủ điều kiện ghi GPS cho chuyến đi này.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const freshContext = await getGpsContext(tripId);
      setContext(freshContext);
      if (!freshContext.permissions.canRecord) throw new Error(freshContext.permissions.cannotRecordReason || 'Không thể ghi GPS.');
      const clientSessionId = generateUUID();
      const deviceId = await getOrCreateDeviceId();

      const res = await startGpsSession(tripId, { clientSessionId, deviceId }, deviceId);
      accumulatedDurationMsRef.current = 0;
      localSegmentStartMsRef.current = Date.now();
      finishedClockRef.current = null;
      setClockNow(Date.now());
      setSession(res.session);
      setPolicy(res.policy);
      gpsProcessorRef.current.reset(Date.parse(res.session.startedAt));

      // Đánh dấu cần sync ngay mẫu đầu tiên
      immediateSyncNeededRef.current = true;

      await saveLocalTripSession(res.session, res.policy);
      setLiveRouteCoords([]);
      setActualRoute(null);
      getGpsContext(tripId).then(setContext).catch(() => {});
      getGpsState(tripId).then(applyGpsState).catch(() => {});
    } catch (err: any) {
      console.warn('[useTripGps] Start session error:', err?.message || err);
      setError(err?.message || 'Không thể bắt đầu phiên ghi GPS.');
    } finally {
      setLoading(false);
    }
  }, [tripId, canViewGps, context]);

  const pauseRecording = useCallback(async () => {
    if (!tripId || !session || isFinishingRef.current) return;
    try {
      setLoading(true);
      const commandId = generateUUID();
      const deviceId = await getOrCreateDeviceId();
      const occurredAt = new Date().toISOString();

      gpsProcessorRef.current.breakSegment();
      if (simulatorRef.current) {
        simulatorRef.current.pause();
      }

      if (localSegmentStartMsRef.current != null) {
        accumulatedDurationMsRef.current += Math.max(0, Date.now() - localSegmentStartMsRef.current);
        localSegmentStartMsRef.current = null;
      }
      setClockNow(Date.now());

      const res = await pauseGpsSession(
        tripId,
        session.id,
        { commandId, expectedVersion: session.version, occurredAt },
        deviceId
      );
      setSession(res.session);
      await updateLocalSessionStatus(session.id, 'PAUSED', res.session.version, null, res.session.recordingIntervals);
    } catch (err: any) {
      console.warn('[useTripGps] Pause session error:', err?.message || err);
      setError(err?.message || 'Lỗi khi tạm dừng phiên.');
    } finally {
      setLoading(false);
    }
  }, [tripId, session]);

  const resumeRecording = useCallback(async () => {
    if (!tripId || !session || isFinishingRef.current) return;
    try {
      setLoading(true);
      const commandId = generateUUID();
      const deviceId = await getOrCreateDeviceId();
      const occurredAt = new Date().toISOString();

      if (simulatorRef.current) {
        simulatorRef.current.resume();
      }

      localSegmentStartMsRef.current = Date.now();
      setClockNow(Date.now());

      const res = await resumeGpsSession(
        tripId,
        session.id,
        { commandId, expectedVersion: session.version, occurredAt },
        deviceId
      );
      setSession(res.session);
      await updateLocalSessionStatus(session.id, 'ACTIVE', res.session.version, null, res.session.recordingIntervals);
    } catch (err: any) {
      console.warn('[useTripGps] Resume session error:', err?.message || err);
      setError(err?.message || 'Lỗi khi tiếp tục phiên.');
    } finally {
      setLoading(false);
    }
  }, [tripId, session]);

  const finishRecording = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!tripId || !currentSession || isFinishingRef.current) return false;
    syncLocalDurationFromSession(currentSession);
    const stoppedAt = Date.now();
    const durationMs = accumulatedDurationMsRef.current + (
      currentSession.status === 'ACTIVE' && localSegmentStartMsRef.current != null
        ? Math.max(0, stoppedAt - localSegmentStartMsRef.current)
        : 0
    );
    finishedClockRef.current = { sessionId: currentSession.id, stoppedAt, durationMs };
    accumulatedDurationMsRef.current = durationMs;
    localSegmentStartMsRef.current = null;
    setClockNow(stoppedAt);
    isFinishingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      // Freeze producers first, then drain their writes and the existing uploader.
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
      simulatorRef.current?.pause();
      await Promise.all([...sampleWritesRef.current]);
      if (isSyncingRef.current) {
        await new Promise<void>((resolve) => syncIdleWaitersRef.current.push(resolve));
      }
      const deviceId = await getOrCreateDeviceId();
      const batchSize = policyRef.current?.maxBatchSamples || 100;
      while (true) {
        const samples = await getPendingSamples(currentSession.id, batchSize);
        if (samples.length === 0) break;
        const uploaded = await uploadGpsSamples(tripId, currentSession.id, { samples }, deviceId);
        const accepted = [...uploaded.acceptedSampleIds, ...uploaded.duplicateSampleIds];
        await markSamplesAccepted(currentSession.id, accepted);
        await markSamplesRejected(currentSession.id, uploaded.rejectedSamples || []);
        const handled = new Set([...accepted, ...(uploaded.rejectedSamples || []).map((sample) => sample.clientSampleId)]);
        if (samples.some((sample) => !handled.has(sample.clientSampleId))) {
          throw new Error('Chưa đồng bộ hết điểm GPS. Vui lòng thử kết thúc lại.');
        }
      }
      // Polling/socket updates do not carry the session's command version.
      const fresh = await getGpsSession(tripId, currentSession.id, deviceId);
      sessionRef.current = fresh.session;
      setSession(fresh.session);
      setPolicy(fresh.policy);
      await saveLocalTripSession(fresh.session, fresh.policy);
      const latestSampleAt = await getLatestSessionSampleTime(currentSession.id);
      const occurredAt = new Date(Math.max(
        stoppedAt,
        Date.parse(fresh.session.startedAt),
        ...(fresh.session.recordingIntervals || []).flatMap((interval) =>
          [Date.parse(interval.start), ...(interval.end ? [Date.parse(interval.end)] : [])]),
        ...(latestSampleAt ? [Date.parse(latestSampleAt)] : [])
      )).toISOString();

      // The trip may have stopped this session before the user pressed Finish.
      const res = fresh.session.status === 'STOPPED'
        ? { session: fresh.session }
        : await finishGpsSession(
            tripId,
            fresh.session.id,
            {
              commandId: generateUUID(),
              expectedVersion: fresh.session.version,
              occurredAt,
              reason: 'USER_FINISHED',
            },
            deviceId
          );
      sessionRef.current = res.session;
      setSession(res.session);

      if (simulatorRef.current) {
        simulatorRef.current.reset();
      }
      gpsProcessorRef.current.reset();

      if (localSegmentStartMsRef.current != null) {
        accumulatedDurationMsRef.current += Math.max(0, Date.now() - localSegmentStartMsRef.current);
        localSegmentStartMsRef.current = null;
      }
      setClockNow(Date.now());

      await updateLocalSessionStatus(currentSession.id, 'STOPPED', res.session.version, res.session.endedAt, res.session.recordingIntervals);
      await pruneCompletedSessionSamples(currentSession.id);

      // Tải lại đường đi thực tế cuối cùng
      getMyActualRoute(tripId).then(setActualRoute).catch(() => {});
      getGpsContext(tripId).then(setContext).catch(() => {});
      return true;
    } catch (err: any) {
      console.warn('[useTripGps] Finish session error:', {
        sessionId: currentSession.id,
        sessionStatus: sessionRef.current?.status,
        sessionVersion: sessionRef.current?.version,
        status: err instanceof ApiError ? err.status : undefined,
        code: err instanceof ApiError ? err.code : undefined,
        details: err instanceof ApiError ? err.details : undefined,
        message: err?.message,
      });
      setError(err?.message || 'Lỗi khi kết thúc phiên.');
      return false;
    } finally {
      isFinishingRef.current = false;
      if (sessionRef.current?.status !== 'STOPPED') {
        finishedClockRef.current = null;
        syncLocalDurationFromSession(sessionRef.current);
        setClockNow(Date.now());
      }
      setTrackingRevision((revision) => revision + 1);
      setLoading(false);
    }
  }, [tripId, syncLocalDurationFromSession]);

  const toggleSimulation = useCallback((val?: boolean) => {
    setIsSimulated((prev) => (typeof val === 'boolean' ? val : !prev));
  }, []);

  const toggleMapMatching = useCallback((val?: boolean) => {
    setIsMapMatchingEnabled((prev) => (typeof val === 'boolean' ? val : !prev));
  }, []);

  // 7. Computed Data
  const myMemberState = useMemo<MemberStateDto | null>(() => {
    if (!gpsState || !gpsState.selfUserId) return null;
    return gpsState.members.find((m) => m.userId === gpsState.selfUserId) || null;
  }, [gpsState]);

  const otherMembers = useMemo<MemberStateDto[]>(() => {
    if (!gpsState) return [];
    return gpsState.members.filter((m) => m.userId !== gpsState.selfUserId);
  }, [gpsState]);

  // Checkpoints
  const checkpoints = useMemo(() => {
    return context?.checkpoints || [];
  }, [context]);

  const arrivedCheckpointIds = useMemo(() => {
    return myMemberState?.checkpointProgress?.arrivedCheckpointIds || [];
  }, [myMemberState]);

  // Mốc Checkpoint tiếp theo cần đến
  const nextCheckpoint = useMemo<TripCheckpointDto | null>(() => {
    if (!checkpoints || checkpoints.length === 0) return null;
    const sorted = [...checkpoints].sort((a, b) => a.sequence - b.sequence);
    return sorted.find((cp) => !arrivedCheckpointIds.includes(cp.id)) || null;
  }, [checkpoints, arrivedCheckpointIds]);

  // Cảnh báo lệch tuyến
  const deviation = useMemo(() => {
    const status = myMemberState?.deviation?.status || 'NORMAL';
    const distanceM = myMemberState?.deviation?.distanceToRouteMeters ?? null;
    return {
      isDeviated: status === 'DEVIATED',
      status,
      distanceM,
    };
  }, [myMemberState]);

  // Thống kê di chuyển
  useEffect(() => {
    setClockNow(Date.now());
    if (session?.status !== 'ACTIVE') return;
    const timer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session?.id, session?.status]);

  const stats = useMemo(() => {
    let totalDurationMs = accumulatedDurationMsRef.current;
    if (session?.status === 'ACTIVE' && localSegmentStartMsRef.current != null) {
      totalDurationMs += Math.max(0, clockNow - localSegmentStartMsRef.current);
    }

    const seconds = Math.floor(totalDurationMs / 1000);
    const recordingTime = !session && seconds === 0
      ? '00:00:00'
      : [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
          .map((value) => String(value).padStart(2, '0'))
          .join(':');

    const distanceM = session?.totalDistanceMeters ?? myMemberState?.session?.totalDistanceMeters ?? 0;
    const distanceKm = (distanceM / 1000).toFixed(2);
    const speedKmh = currentLocation?.speedMps != null ? (currentLocation.speedMps * 3.6).toFixed(1) : '0.0';
    const altitudeM = currentLocation?.altitudeM != null ? Math.round(currentLocation.altitudeM) : '--';
    const accuracyM = currentLocation?.accuracyM != null ? Math.round(currentLocation.accuracyM) : 8;

    return {
      recordingTime,
      distanceKm,
      speedKmh,
      altitudeM,
      accuracyM,
    };
  }, [session, myMemberState, currentLocation, clockNow]);

  return {
    context,
    gpsState,
    session,
    policy,
    myMemberState,
    otherMembers,
    plannedRouteCoords,
    liveRouteCoords,
    currentLocation,
    checkpoints,
    arrivedCheckpointIds,
    nextCheckpoint,
    deviation,
    stats,
    actualRoute,
    loading,
    syncing,
    error,
    socketConnected,
    isSimulated,
    setIsSimulated,
    toggleSimulation,
    isMapMatchingEnabled,
    setIsMapMatchingEnabled,
    toggleMapMatching,
    startRecording,
    pauseRecording,
    resumeRecording,
    finishRecording,
    refreshState: loadContextAndActiveSession,
  };
}
