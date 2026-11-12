"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  getLeaderPublicTripDetail,
  getLeaderTripErrorMessage,
} from "../services/leader-public-trips.api";
import type { LeaderTripView } from "../types/leader-trips";

interface UseLeaderTripDetailOptions {
  tripId?: string | null;
  enabled?: boolean;
}

export function useLeaderTripDetail({
  tripId,
  enabled = true,
}: UseLeaderTripDetailOptions) {
  const [trip, setTrip] = useState<LeaderTripView | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!tripId && enabled);
  const [loadError, setLoadError] = useState<{ tripId: string; message: string; status?: number } | null>(null);
  const error = loadError?.tripId === tripId ? loadError : null;

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!tripId) {
        setTrip(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getLeaderPublicTripDetail(tripId, signal);
        setTrip(data);
        return data;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") {
          return;
        }
        const msg = getLeaderTripErrorMessage(
          err,
          "Không thể tải chi tiết chuyến đi."
        );
        setLoadError({ tripId, message: msg, status: axios.isAxiosError(err) ? err.response?.status : undefined });
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [tripId]
  );

  useEffect(() => {
    if (!enabled || !tripId) return;

    const controller = new AbortController();
    fetchDetail(controller.signal);

    return () => {
      controller.abort();
    };
  }, [enabled, tripId, fetchDetail]);

  return {
    trip,
    isLoading,
    error: error?.message ?? null,
    errorStatus: error?.status,
    refetch: () => fetchDetail(),
  };
}
