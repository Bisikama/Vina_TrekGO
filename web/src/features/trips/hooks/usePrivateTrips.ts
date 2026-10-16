"use client";

import { useCallback, useState } from "react";
import { privateTripsApi, type PrivateTrip, type PrivateSource, type PrivateInput } from "../services/private-trips.api";

export function usePrivateTrips() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [trips, setTrips] = useState<PrivateTrip[]>([]);
  const [sources, setSources] = useState<PrivateSource[]>([]);
  const [pickups, setPickups] = useState<{ id: string; name: string }[]>([]);
  const [trip, setTrip] = useState<PrivateTrip | null>(null);

  const loadTrips = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await privateTripsApi.list();
      setTrips(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || "Không thể tải danh sách chuyến riêng.");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadSources = useCallback(async () => {
    setBusy(true);
    try {
      const data = await privateTripsApi.sources();
      setSources(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể tải danh sách tuyến đường.");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadPickups = useCallback(async (destinationId: string) => {
    try {
      const data = await privateTripsApi.pickups(destinationId);
      setPickups(data);
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  const getById = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const detail = await privateTripsApi.getById(id);
      setTrip(detail);
      if (detail.destinationId) {
        await loadPickups(detail.destinationId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể tải chi tiết chuyến đi.");
    } finally {
      setBusy(false);
    }
  }, [loadPickups]);

  const create = async (input: PrivateInput & { type: 'PERSONAL' | 'SYSTEM'; trailRef: string; destinationId: string; checkpointIds: string[] }) => {
    setBusy(true);
    setError(null);
    try {
      const created = await privateTripsApi.create(input);
      setTrip(created);
      await loadTrips();
      return created;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || "Không thể tạo chuyến riêng.";
      const details = err?.response?.data?.error?.details;
      const detailStr = details ? " (Chi tiết: " + JSON.stringify(details) + ")" : "";
      setError(msg + detailStr);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const update = async (input: PrivateInput) => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await privateTripsApi.update(trip, input);
      setTrip(updated);
      await loadTrips();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể cập nhật chuyến riêng.");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (targetTrip: PrivateTrip, reason: string) => {
    if (!targetTrip) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await privateTripsApi.cancel(targetTrip, reason);
      if (trip && trip.id === targetTrip.id) setTrip(updated);
      await loadTrips();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể huỷ chuyến riêng.");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const invite = async (targetTrip: PrivateTrip, expiresAt?: string) => {
    if (!targetTrip) return;
    setBusy(true);
    setError(null);
    try {
      const data = await privateTripsApi.invite(targetTrip, expiresAt);
      if (trip && trip.id === targetTrip.id) {
        setTrip(prev => prev ? { ...prev, version: data.tripVersion } : prev);
      }
      return data;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể tạo lời mời.");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await privateTripsApi.revoke(trip);
      setTrip(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể thu hồi lời mời.");
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    error,
    trips,
    trip,
    sources,
    pickups,
    loadTrips,
    loadSources,
    loadPickups,
    getById,
    create,
    update,
    cancel,
    invite,
    revoke,
  };
}
