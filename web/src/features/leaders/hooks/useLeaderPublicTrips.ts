"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLeaderTripErrorMessage,
  listLeaderPublicTrips,
} from "../services/leader-public-trips.api";
import type {
  LeaderTripPaginationQuery,
  LeaderTripView,
} from "../types/leader-trips";

interface UseLeaderPublicTripsOptions extends LeaderTripPaginationQuery {
  enabled?: boolean;
}

export function useLeaderPublicTrips(options: UseLeaderPublicTripsOptions = {}) {
  const { page = 1, pageSize = 20, destinationId, enabled = true } = options;

  const [trips, setTrips] = useState<LeaderTripView[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listLeaderPublicTrips(
        { page, pageSize, destinationId },
        signal
      );
      setTrips(data);
      return data;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") {
        return;
      }
      const msg = getLeaderTripErrorMessage(
        err,
        "Không thể tải danh sách chuyến đi của Leader."
      );
      setError(msg);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, destinationId]);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    fetchTrips(controller.signal);

    return () => {
      controller.abort();
    };
  }, [enabled, fetchTrips]);

  return {
    trips,
    isLoading,
    error,
    refetch: () => fetchTrips(),
  };
}
