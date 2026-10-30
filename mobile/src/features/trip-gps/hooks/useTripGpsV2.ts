import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api-client';
import { getLocalTripDistance } from '../services/trip-gps.result';
import { snapToRoute } from '@/utils/mapMatching';
import { TripGpsSimulator } from '@/services/location/tripGpsSimulator';
import { getGpsContext, getGpsSession, getGpsState, getMyActualRoute, startGpsSession } from '../services/trip-gps.api';
import { getOrCreateDeviceId } from '../services/trip-gps.storage';
import { cacheTrip, commitControl, getStartId, listLocalTrips, localSamples, readTripCache, saveStartedTrip, type LocalTrip } from '../services/trip-gps.v2-storage';
import { ingestLocations } from '../services/trip-gps.collector';
import { tripGpsRuntime } from '../services/trip-gps.runtime';
import { mergeMember, mergeState, patchLocation, patchPresence } from '../services/trip-gps.merge';
import type { ActualRouteResponse, GpsContextResponse, GpsSample, GpsStateResponse, LocalSyncStatus, SyncCommand } from '../types';

export function useTripGps(tripId?: string) {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const account = user?.id;
  const [savedLocal, setLocal] = useState<LocalTrip | null>(null);
  const local = savedLocal && savedLocal.accountId === account && savedLocal.session.tripId === tripId ? savedLocal : null;
  const [contextCache, setContextCache] = useState<{ owner: string; value: GpsContextResponse } | null>(null);
  const context = contextCache && contextCache.owner === account && contextCache.value.tripId === tripId ? contextCache.value : null;
  const [savedState, setGpsState] = useState<GpsStateResponse | null>(null);
  const gpsState = savedState && savedState.selfUserId === account && savedState.tripId === tripId ? savedState : null;
  const [savedRoute, setActualRoute] = useState<ActualRouteResponse | null>(null);
  const actualRoute = savedRoute && savedRoute.userId === account && savedRoute.tripId === tripId ? savedRoute : null;
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isSimulated] = useState(true);
  const [isMapMatchingEnabled, setIsMapMatchingEnabled] = useState(true);
  const [clock, setClock] = useState(() => Date.now());
  const active = useRef({ account, tripId });
  const mounted = useRef(true);
  const controlLock = useRef(false);
  const localLoadRevision = useRef(0);
  const localRef = useRef(local);
  useEffect(() => { active.current = { account, tripId }; localRef.current = local; }, [account, tripId, local]);
  const simulatorRef = useRef<TripGpsSimulator | null>(null);
  const valid = useCallback((owner: string, trip: string) => mounted.current && active.current.account === owner && active.current.tripId === trip, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const loadLocal = useCallback(async () => {
    if (!account || !tripId) return;
    const revision = ++localLoadRevision.current;
    const trips = await listLocalTrips(account, tripId);
    const current = trips.find(t => t.session.status !== 'STOPPED') ?? trips[0] ?? null;
    if (!valid(account, tripId) || revision !== localLoadRevision.current) return;
    setLocal(current);
    if (current) {
      const points = await localSamples(account, current.session.id);
      if (valid(account, tripId) && revision === localLoadRevision.current) setSamples(points);
    }
  }, [account, tripId, valid]);

  const refreshNetwork = useCallback(async () => {
    if (!account || !tripId || !accessToken) return;
    try {
      const ctx = await getGpsContext(tripId);
      if (!valid(account, tripId)) return;
      await cacheTrip(account, tripId, ctx);
      if (!valid(account, tripId)) return;
      setContextCache({ owner: account, value: ctx });
      const state = await getGpsState(tripId);
      if (!valid(account, tripId) || state.selfUserId !== account) return;
      await cacheTrip(account, tripId, undefined, state);
      if (!valid(account, tripId)) return;
      setGpsState(previous => mergeState(previous, state));
      const own = (await listLocalTrips(account, tripId))[0];
      if (!own) {
        const serverSession = state.members.find(m => m.userId === account)?.session;
        if (serverSession && serverSession.status !== 'STOPPED') {
          const remote = await getGpsSession(tripId, serverSession.id, await getOrCreateDeviceId());
          if (!valid(account, tripId) || remote.session.userId !== account) return;
          if (remote.protocolVersion !== 2) setError('Phiên GPS cũ dùng protocol v1 đang mở. Ứng dụng này chỉ hỗ trợ v2; dữ liệu cũ được giữ nguyên, không tự chuyển protocol.');
          else {
            const startId = await getStartId(account, tripId);
            if (remote.session.clientSessionId === startId && remote.session.sampleCount === 0) {
              await saveStartedTrip(account, remote); await loadLocal(); await tripGpsRuntime.reconcileCollector();
            } else setError('Phiên GPS v2 trên server thiếu trạng thái local trên máy. Giữ nguyên dữ liệu và kiểm tra thiết bị đang ghi.');
          }
        } else if (!ctx.capabilities?.supportedSyncProtocols.includes(2)) setError('Máy chủ chưa cho phép tạo phiên GPS v2. Không chuyển sang GPS v1.');
      }
      const route = await getMyActualRoute(tripId);
      if (valid(account, tripId)) setActualRoute(previous => previous?.tripId === route.tripId && previous.userId === route.userId && previous.version > route.version ? previous : route);
    } catch (failure) {
      if (!valid(account, tripId)) return;
      if (failure instanceof ApiError && failure.status === 403) await tripGpsRuntime.denyAccess(tripId).catch(error => console.warn('[TripGps access]', error));
      if (!valid(account, tripId)) return;
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) setError(failure.message);
      else if (!localRef.current) setError('Chưa tải được dữ liệu GPS. Kiểm tra kết nối hoặc mở lại phiên đã lưu trên máy.');
    }
  }, [account, tripId, accessToken, loadLocal, valid]);
  const refreshNetworkRef = useRef(refreshNetwork);
  useEffect(() => { refreshNetworkRef.current = refreshNetwork; }, [refreshNetwork]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLocal(null); setContextCache(null); setGpsState(null); setSamples([]); setActualRoute(null); setError(null); setLoading(true);
      if (authLoading) return;
      if (!account || !tripId) { setError(!account ? 'Vui lòng đăng nhập để sử dụng GPS.' : 'Thiếu mã chuyến đi.'); setLoading(false); return; }
      const cache = await readTripCache(account, tripId);
      if (cancelled || !valid(account, tripId)) return;
      setContextCache(cache.context ? { owner: account, value: cache.context } : null); setGpsState(cache.state);
      await loadLocal();
      if (cancelled) return;
      setLoading(false);
      await refreshNetworkRef.current();
    })().catch(failure => { if (!cancelled && account && tripId && valid(account, tripId)) { setError(String(failure)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [account, tripId, authLoading, loadLocal, valid]);

  useEffect(() => {
    if (!account || !tripId) return;
    return tripGpsRuntime.on(event => {
      if (!valid(account, tripId) || (event.tripId && event.tripId !== tripId)) return;
      if (event.kind === 'refresh') void loadLocal().catch(e => setError(String(e)));
      if (event.kind === 'state') void refreshNetwork();
      if (event.kind === 'socket') setSocketConnected(event.connected ?? false);
      if (event.kind === 'error') setError(event.message ?? 'Lỗi GPS.');
      if (event.kind === 'sample' && event.sample) {
        const point = event.sample;
        setSamples(previous => previous.some(p => p.clientSampleId === point.clientSampleId) ? previous : [...previous, point]);
        setLocal(previous => previous && previous.syncStatus === 'SYNCED' ? { ...previous, syncStatus: 'PENDING' } : previous);
      }
      if (event.kind === 'location' && event.location) setGpsState(state => state ? { ...state, members: state.members.map(m => patchLocation(m, event.location!.data)) } : state);
      if (event.kind === 'presence' && event.presence) setGpsState(state => state ? { ...state, members: state.members.map(m => patchPresence(m, event.presence!.data)) } : state);
      if (event.kind === 'member' && event.member) setGpsState(state => {
        if (!state) { void refreshNetwork(); return state; }
        const incoming = event.member!.data.member, previous = state.members.find(m => m.userId === incoming.userId);
        return { ...state, members: previous ? state.members.map(m => m.userId === incoming.userId ? mergeMember(m, incoming) : m) : [...state.members, incoming] };
      });
    });
  }, [account, tripId, loadLocal, refreshNetwork, valid]);
  useEffect(() => {
    if (!account || !tripId || !context?.permissions.canViewGroupLocations || local?.accessBlocked) return;
    void Promise.resolve().then(() => { if (valid(account, tripId)) setSocketConnected(tripGpsRuntime.isConnected(tripId)); });
    const unwatch = tripGpsRuntime.watch(tripId);
    const timer = setInterval(() => { void refreshNetwork(); void loadLocal().catch(e => setError(String(e))); }, 20000);
    return () => { unwatch(); clearInterval(timer); };
  }, [account, tripId, context?.permissions.canViewGroupLocations, local?.accessBlocked, refreshNetwork, loadLocal, valid]);

  const session = local?.session ?? null;
  const sessionId = session?.id;
  const sessionStatus = session?.status;
  const activePlan = context?.routePlans.find(p => p.trailPlanId === context.activeTrailPlanId) ?? context?.routePlans[0];
  // REST refreshes create new objects even when the trail geometry has not changed.
  const plannedRouteJson = JSON.stringify(activePlan?.geometry?.type === 'LineString' ? activePlan.geometry.coordinates : activePlan?.geometry?.type === 'MultiLineString' ? activePlan.geometry.coordinates.flat() : []);
  const plannedRouteCoords = useMemo<[number, number][]>(() => {
    return JSON.parse(plannedRouteJson);
  }, [plannedRouteJson]);
  const displayPoints = useMemo(() => (local ? samples : []).map(point => {
    if (!isMapMatchingEnabled || plannedRouteCoords.length < 2) return point;
    const snapped = snapToRoute(point, plannedRouteCoords, local?.policy.deviationThresholdM ?? 35);
    return snapped.snapped ? { ...point, latitude: snapped.latitude, longitude: snapped.longitude } : point;
  }), [samples, isMapMatchingEnabled, plannedRouteCoords, local]);
  const liveRouteCoords = useMemo<[number, number][]>(() => displayPoints.map(p => [p.longitude, p.latitude]), [displayPoints]);
  const currentLocation = useMemo(() => {
    const p = displayPoints.at(-1);
    return p ? { ...p, altitudeM: p.altitudeM ?? null, speedMps: p.speedMps ?? null, headingDeg: p.headingDeg ?? null } : null;
  }, [displayPoints]);

  useEffect(() => {
    return () => {
      simulatorRef.current?.stop(); simulatorRef.current = null;
    };
  }, [account, sessionId, isSimulated]);
  // Session creation/refresh must not briefly switch a selected fake collector to real GPS.
  useEffect(() => {
    void tripGpsRuntime.setSimulated(isSimulated).catch(e => setError(String(e)));
  }, [isSimulated]);
  useEffect(() => {
    if (!account || !sessionId || !isSimulated || sessionStatus !== 'ACTIVE') return;
    let cancelled = false;
    void tripGpsRuntime.setSimulated(true).then(() => {
      if (cancelled) return;
      const simulator = simulatorRef.current ?? new TripGpsSimulator({ routeCoords: plannedRouteCoords, intervalMs: Math.max(1000, (local?.policy.sampleIntervalSeconds ?? 5) * 1000) });
      simulator.updateRoute(plannedRouteCoords);
      simulatorRef.current = simulator;
      simulator.start(location => { void ingestLocations(account, sessionId, [location], 'SIMULATOR').catch(e => setError(String(e))); }, false);
    }).catch(e => setError(String(e)));
    return () => { cancelled = true; simulatorRef.current?.stop(); };
  }, [account, sessionId, sessionStatus, isSimulated, plannedRouteCoords, local?.policy.sampleIntervalSeconds]);
  useEffect(() => {
    if (session?.status !== 'ACTIVE') return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session?.status]);

  const startRecording = useCallback(async () => {
    if (!account || !tripId || controlLock.current) return;
    controlLock.current = true; setBusy(true); setError(null);
    try {
      const ctx = await getGpsContext(tripId);
      if (!valid(account, tripId)) return;
      setContextCache({ owner: account, value: ctx }); await cacheTrip(account, tripId, ctx);
      if (!ctx.permissions.canStartNewSession || !ctx.capabilities?.supportedSyncProtocols.includes(2)) throw new Error(ctx.permissions.cannotRecordReason ?? 'Chưa thể bắt đầu phiên GPS v2 mới.');
      if ((await listLocalTrips(account)).some(t => !t.finalProcessed && t.session.status === 'STOPPED')) throw new Error('Cần đồng bộ xong phiên đã kết thúc trước khi tạo phiên mới.');
      const clientSessionId = await getStartId(account, tripId), deviceId = await getOrCreateDeviceId(true);
      const response = await startGpsSession(tripId, { clientSessionId, deviceId, protocolVersion: 2 }, deviceId);
      if (!valid(account, tripId)) return;
      const saved = await saveStartedTrip(account, response);
      if (!valid(account, tripId)) return;
      localLoadRevision.current++;
      if (isSimulated) await tripGpsRuntime.setSimulated(true);
      setLocal(saved); setSamples([]); setActualRoute(null); setClock(Date.now());
      await tripGpsRuntime.reconcileCollector(true);
    } catch (failure) { if (valid(account, tripId)) setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { controlLock.current = false; if (valid(account, tripId)) setBusy(false); }
  }, [account, tripId, valid, isSimulated]);

  const control = useCallback(async (action: SyncCommand['action']): Promise<boolean> => {
    const current = localRef.current;
    if (!account || !tripId || !current || current.accessBlocked || controlLock.current) return false;
    controlLock.current = true; setBusy(true); setError(null);
    try {
      // Freeze producers and drain writes; never wait for a network request here.
      simulatorRef.current?.pause();
      await tripGpsRuntime.suspendCollector();
      const updated = await commitControl(account, current.session.id, action);
      if (!valid(account, tripId)) return false;
      localLoadRevision.current++;
      setLocal(updated); localRef.current = updated; setClock(Date.now());
      if (action === 'FINISH') {
        const recorded = await localSamples(account, updated.session.id);
        if (!valid(account, tripId)) return false;
        setSamples(recorded);
      }
      if (action === 'RESUME') simulatorRef.current?.resume();
      void tripGpsRuntime.reconcileCollector(action === 'RESUME').catch(e => setError(String(e)));
      if (action === 'FINISH' || updated.controlSyncMode === 'IMMEDIATE_LEGACY') {
        const sync = action === 'FINISH' ? tripGpsRuntime.sync(tripId, true) : tripGpsRuntime.syncMetadata(tripId);
        void sync.catch(e => setError(String(e)));
      }
      return true;
    } catch (failure) {
      if (valid(account, tripId)) setError(`Chưa lưu được thao tác GPS: ${failure instanceof Error ? failure.message : String(failure)}`);
      if (localRef.current?.session.status === 'ACTIVE') simulatorRef.current?.resume();
      void tripGpsRuntime.reconcileCollector().catch(e => console.warn('[TripGps collector]', e));
      return false;
    } finally { controlLock.current = false; if (valid(account, tripId)) setBusy(false); }
  }, [account, tripId, valid]);
  const syncNow = useCallback(() => tripGpsRuntime.sync(tripId, true), [tripId]);
  const myMemberState = gpsState?.members.find(m => m.userId === account) ?? null;
  const otherMembers = gpsState?.members.filter(m => m.userId !== account) ?? [];
  const checkpoints = context?.checkpoints ?? [];
  const arrivedCheckpointIds = myMemberState?.checkpointProgress.arrivedCheckpointIds ?? [];
  const nextCheckpoint = [...checkpoints].sort((a, b) => a.sequence - b.sequence).find(cp => !arrivedCheckpointIds.includes(cp.id)) ?? null;
  const localDistance = useMemo(() => {
    return getLocalTripDistance(samples, session?.recordingIntervals, local?.policy.signalGapSeconds);
  }, [samples, session?.recordingIntervals, local?.policy.signalGapSeconds]);
  const stats = useMemo(() => {
    const intervals = session?.recordingIntervals?.length ? session.recordingIntervals : (session ? [{ start: session.startedAt, end: session.endedAt }] : []);
    const elapsed = intervals.reduce((sum, i) => sum + Math.max(0, (i.end ? Date.parse(i.end) : clock) - Date.parse(i.start)), 0);
    const seconds = Math.floor(elapsed / 1000);
    return { recordingTime: [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, '0')).join(':'),
      distanceKm: (localDistance / 1000).toFixed(2), speedKmh: ((currentLocation?.speedMps ?? 0) * 3.6).toFixed(1),
      altitudeM: currentLocation?.altitudeM != null ? Math.round(currentLocation.altitudeM) : '--', accuracyM: currentLocation?.accuracyM ?? 0 };
  }, [session, localDistance, currentLocation, clock]);
  const summaryRouteCoords = useMemo<[number, number][]>(() => samples.map(point => [point.longitude, point.latitude]), [samples]);
  const deviation = { isDeviated: myMemberState?.deviation.status === 'DEVIATED', status: myMemberState?.deviation.status ?? 'UNKNOWN', distanceM: myMemberState?.deviation.distanceToRouteMeters ?? null };
  const toggleMapMatching = useCallback((value?: boolean) => setIsMapMatchingEnabled(previous => value ?? !previous), []);
  const syncStatus: LocalSyncStatus = local?.syncStatus ?? 'PENDING';
  const rejectedSampleCount = (local?.rejectedSamples?.length ?? 0) + (local?.snapshot?.batches.reduce((n, b) => n + (b.ack?.rejectedSamples.length ?? 0), 0) ?? 0);
  return { context, gpsState, session, policy: local?.policy ?? context?.policy ?? null, myMemberState, otherMembers, plannedRouteCoords, liveRouteCoords, summaryRouteCoords, currentLocation,
    checkpoints, arrivedCheckpointIds, nextCheckpoint, deviation, stats, actualRoute, loading: loading || busy,
    syncing: syncStatus === 'SYNCING', syncStatus, syncNow, rejectedSampleCount, isV2: true, error: error ?? local?.lastError ?? null, socketConnected,
    isSimulated, isMapMatchingEnabled, setIsMapMatchingEnabled, toggleMapMatching,
    startRecording, pauseRecording: () => control('PAUSE'), resumeRecording: () => control('RESUME'), finishRecording: () => control('FINISH'),
    refreshState: async () => { await loadLocal(); await refreshNetwork(); } };
}
