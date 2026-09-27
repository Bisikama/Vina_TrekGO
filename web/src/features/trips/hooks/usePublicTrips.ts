'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/features/auth';
import { tripsApi } from '../services/trips.api';
import type { Option, Readiness, Trail, Trip, TripInput } from '../types/trip.types';

export const usePublicTrips = () => {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [destinations, setDestinations] = useState<Option[]>([]);
  const [pickups, setPickups] = useState<Option[]>([]);
  const [checkpoints, setCheckpoints] = useState<Option[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [page, setPage] = useState(1);
  const [trailPage, setTrailPage] = useState(1);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); }
    catch (e) {
      if (axios.isAxiosError<{ message?: string; code?: string; issues?: { message: string }[] }>(e)) {
        setError([e.response?.data?.message || e.message, ...(e.response?.data?.issues?.map(i => i.message) || [])].join(' '));
        if (e.response?.status === 401) { useAuthStore.getState().logout(); setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); }
      } else setError(e instanceof Error ? e.message : 'Không thể thực hiện thao tác.');
    } finally { setBusy(false); }
  }, []);
  const allOptions = async (kind: 'destinations' | 'pickup-points' | 'checkpoints', destinationId?: string) => {
    const result: Option[] = [];
    for (let p = 1; ; p++) { const items = await tripsApi.options(kind, destinationId, p); result.push(...items); if (items.length < 100) return result; }
  };
  useEffect(() => {
    let cancelled = false;
    if (!token || user?.role !== 'LEADER') return;
    void Promise.all([tripsApi.list(), allOptions('destinations')]).then(([items, options]) => {
      if (cancelled) return;
      setTrip(null); setReadiness(null); setTrails([]); setTrips(items); setDestinations(options); setPage(1); setError('');
    }).catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : 'Không thể tải danh sách chuyến.');
    }).finally(() => { if (!cancelled) setLoadedToken(token); });
    return () => { cancelled = true; };
  }, [token, user?.role]);
  const loadDestination = (destinationId: string) => run(async () => {
    if (!destinationId) { setPickups([]); setCheckpoints([]); return; }
    const [p, c] = await Promise.all([allOptions('pickup-points', destinationId), allOptions('checkpoints', destinationId)]);
    setPickups(p); setCheckpoints(c);
  });
  const open = (id: string) => run(async () => {
    const t = await tripsApi.detail(id);
    const [p, c, suggestions] = await Promise.all([allOptions('pickup-points', t.destinationId), allOptions('checkpoints', t.destinationId), tripsApi.suggestions(id, 1)]);
    setTrip(t); setPickups(p); setCheckpoints(c); setTrails(suggestions); setTrailPage(1); setReadiness(null);
  });
  const accept = async (t: Trip) => { setTrip(t); setReadiness(null); setTrips(await tripsApi.list(page)); };
  const save = (input: TripInput) => run(async () => { const t = trip ? await tripsApi.update(trip.id, trip.version, input) : await tripsApi.create(input); await accept(t); setTrails(await tripsApi.suggestions(t.id, 1)); setTrailPage(1); setNotice('Đã lưu bản nháp.'); });
  const setCheckpointIds = (ids: string[]) => run(async () => { if (!trip) return; await accept(await tripsApi.checkpoints(trip, ids)); setTrails(await tripsApi.suggestions(trip.id, 1)); setTrailPage(1); });
  const setTrailIds = (ids: string[]) => run(async () => { if (!trip) return; await accept(await tripsApi.trails(trip, ids)); setTrails(await tripsApi.suggestions(trip.id, 1)); setTrailPage(1); });
  return { user, token, trip, trips, busy: busy || (!!token && user?.role === 'LEADER' && loadedToken !== token), error, notice, readiness, destinations, pickups, checkpoints, trails, page, trailPage,
    open, save, loadDestination, setCheckpointIds, setTrailIds,
    newDraft: () => { setTrip(null); setPickups([]); setCheckpoints([]); setTrails([]); setReadiness(null); setError(''); setNotice(''); },
    refresh: () => trip ? open(trip.id) : run(async () => setTrips(await tripsApi.list(page))),
    listPage: (p: number) => run(async () => { setTrips(await tripsApi.list(p)); setPage(p); }),
    suggestionsPage: (p: number) => run(async () => { if (trip) { setTrails(await tripsApi.suggestions(trip.id, p)); setTrailPage(p); } }),
    review: () => run(async () => { if (trip) setReadiness(await tripsApi.readiness(trip.id)); }),
    publish: () => run(async () => { if (trip) { await accept(await tripsApi.publish(trip)); setNotice('Trip đã OPEN và xuất hiện trong danh sách công khai.'); } }),
    cancel: (reason: string) => run(async () => { if (trip) { await accept(await tripsApi.cancel(trip, reason)); setNotice('Đã gửi yêu cầu hủy, chờ Admin duyệt.'); } }),
  };
};
