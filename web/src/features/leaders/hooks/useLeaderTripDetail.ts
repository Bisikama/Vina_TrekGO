"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!tripId) {
        setTrip(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
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
        setError(msg);
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
    error,
    refetch: () => fetchDetail(),
  };
}
