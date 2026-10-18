"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { privateTripsApi, type PrivateTrip, type PrivateInput } from "../services/private-trips.api";
import { useStaticDataStore } from "@/lib/staticDataStore";

export function usePrivateTrips() {
  const [mutationBusy, setMutationBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const {
    data: swrTrips,
    error: swrError,
    isLoading: swrLoading,
    mutate: mutateTrips,
  } = useSWR<PrivateTrip[]>(
    "private-trips",
    () => privateTripsApi.list(),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  const sources = useStaticDataStore((s) => s.privateSources);
  const loadPrivateSources = useStaticDataStore((s) => s.loadPrivateSources);
  const loadPickupsForDestination = useStaticDataStore((s) => s.loadPickupsForDestination);

  const [pickups, setPickups] = useState<{ id: string; name: string }[]>([]);
  const [trip, setTrip] = useState<PrivateTrip | null>(null);

  const trips = swrTrips || [];

  const loadTrips = useCallback(async () => {
    setMutationError(null);
    try {
      await mutateTrips();
    } catch (err: any) {
      setMutationError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          "Không thể tải danh sách chuyến riêng."
      );
    }
  }, [mutateTrips]);

  const loadSources = useCallback(async () => {
    try {
      await loadPrivateSources();
    } catch (err: any) {
      setMutationError(err?.response?.data?.message || "Không thể tải danh sách tuyến đường.");
    }
  }, [loadPrivateSources]);

  const loadPickups = useCallback(
    async (destinationId: string) => {
      try {
        const data = await loadPickupsForDestination(destinationId);
        setPickups(data);
      } catch (err: any) {
        console.error(err);
      }
    },
    [loadPickupsForDestination]
  );

  const getById = useCallback(async (id: string) => {
    setMutationBusy(true);
    setMutationError(null);
    try {
      const detail = await privateTripsApi.getById(id);
      setTrip(detail);
      if (detail.destinationId) {
        await loadPickups(detail.destinationId);
      }
    } catch (err: any) {
      setMutationError(err?.response?.data?.message || "Không thể tải chi tiết chuyến đi.");
    } finally {
      setMutationBusy(false);
    }
  }, [loadPickups]);

  const create = async (input: PrivateInput & { type: 'PERSONAL' | 'SYSTEM'; trailRef: string; destinationId: string; checkpointIds: string[] }) => {
    setMutationBusy(true);
    setMutationError(null);
    try {
      const created = await privateTripsApi.create(input);
      setTrip(created);
      await mutateTrips();
      return created;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || "Không thể tạo chuyến riêng.";
      const details = err?.response?.data?.error?.details;
      const detailStr = details ? " (Chi tiết: " + JSON.stringify(details) + ")" : "";
      setMutationError(msg + detailStr);
      return null;
    } finally {
      setMutationBusy(false);
    }
  };

  const update = async (input: PrivateInput) => {
    if (!trip) return;
    setMutationBusy(true);
    setMutationError(null);
    try {
      const updated = await privateTripsApi.update(trip, input);
      setTrip(updated);
      await mutateTrips();
    } catch (err: any) {
      setMutationError(err?.response?.data?.message || "Không thể cập nhật chuyến riêng.");
      throw err;
    } finally {
      setMutationBusy(false);
    }
  };

  const cancel = async (targetTrip: PrivateTrip, reason: string) => {
    if (!targetTrip) return;
    setMutationBusy(true);
    setMutationError(null);
    try {
      const updated = await privateTripsApi.cancel(targetTrip, reason);
      if (trip && trip.id === targetTrip.id) setTrip(updated);
      await mutateTrips();
    } catch (err: any) {
      setMutationError(err?.response?.data?.message || "Không thể huỷ chuyến riêng.");
      throw err;
    } finally {
      setMutationBusy(false);
    }
  };

  const invite = async (targetTrip: PrivateTrip, expiresAt?: string) => {
    if (!targetTrip) return;
    setMutationBusy(true);
    setMutationError(null);
    try {
      const data = await privateTripsApi.invite(targetTrip, expiresAt);
      if (trip && trip.id === targetTrip.id) {
        setTrip(prev => prev ? { ...prev, version: data.tripVersion } : prev);
      }
      return data;
    } catch (err: any) {
      setMutationError(err?.response?.data?.message || "Không thể tạo lời mời.");
      throw err;
    } finally {
      setMutationBusy(false);
    }
  };

  const revoke = async () => {
    if (!trip) return;
    setMutationBusy(true);
    setMutationError(null);
    try {
      const updated = await privateTripsApi.revoke(trip);
      setTrip(updated);
    } catch (err: any) {
      setMutationError(err?.response?.data?.message || "Không thể thu hồi lời mời.");
      throw err;
    } finally {
      setMutationBusy(false);
    }
  };

  const swrErrorMessage = swrError
    ? (swrError as any)?.response?.data?.error?.message ||
      (swrError as any)?.response?.data?.message ||
      "Không thể tải danh sách chuyến riêng."
    : null;

  return {
    busy: mutationBusy || (swrLoading && !swrTrips),
    error: mutationError || swrErrorMessage,
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
