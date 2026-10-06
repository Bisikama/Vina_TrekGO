"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLeaderTripErrorMessage,
  getLeaderTripReadiness,
} from "../services/leader-public-trips.api";
import type { TripReadinessResult } from "../types/leader-trips";

interface UseLeaderTripReadinessOptions {
  tripId?: string | null;
  enabled?: boolean;
}

export function useLeaderTripReadiness({
  tripId,
  enabled = true,
}: UseLeaderTripReadinessOptions) {
  const [readiness, setReadiness] = useState<TripReadinessResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!tripId && enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchReadiness = useCallback(
    async (signal?: AbortSignal) => {
      if (!tripId) {
        setReadiness(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await getLeaderTripReadiness(tripId, signal);
        setReadiness(data);
        return data;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") {
          return;
        }
        const msg = getLeaderTripErrorMessage(
          err,
          "Không thể kiểm tra tính sẵn sàng của chuyến đi."
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
    fetchReadiness(controller.signal);

    return () => {
      controller.abort();
    };
  }, [enabled, tripId, fetchReadiness]);

  return {
    readiness,
    canPublish: readiness?.canPublish ?? false,
    issues: readiness?.issues ?? [],
    version: readiness?.version ?? 1,
    isLoading,
    error,
    refetch: () => fetchReadiness(),
  };
}
