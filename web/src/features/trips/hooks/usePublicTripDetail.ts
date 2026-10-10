"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicTripDetail } from "../services/public-trips.api";
import type { PublicTripItem } from "../types/public-trips";

interface UsePublicTripDetailOptions {
  tripId?: string | null;
  enabled?: boolean;
}

export function usePublicTripDetail({
  tripId,
  enabled = true,
}: UsePublicTripDetailOptions) {
  const [trip, setTrip] = useState<PublicTripItem | null>(null);
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
        const data = await getPublicTripDetail(tripId, signal);
        setTrip(data);
        return data;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") {
          return;
        }
        setError("Không thể tải chi tiết chuyến đi công khai.");
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
