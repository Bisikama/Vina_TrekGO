"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLeaderTrailSuggestions,
  getLeaderTripErrorMessage,
} from "../services/leader-public-trips.api";
import type {
  LeaderTripPaginationQuery,
  TrailSuggestion,
} from "../types/leader-trips";

interface UseLeaderTrailSuggestionsOptions extends LeaderTripPaginationQuery {
  tripId?: string | null;
  enabled?: boolean;
}

export function useLeaderTrailSuggestions(
  options: UseLeaderTrailSuggestionsOptions
) {
  const { tripId, page = 1, pageSize = 20, enabled = true } = options;

  const [suggestions, setSuggestions] = useState<TrailSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!tripId && enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(
    async (signal?: AbortSignal) => {
      if (!tripId) {
        setSuggestions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await getLeaderTrailSuggestions(
          tripId,
          { page, pageSize },
          signal
        );
        setSuggestions(data);
        return data;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "CanceledError") {
          return;
        }
        const msg = getLeaderTripErrorMessage(
          err,
          "Không thể tải gợi ý cung đường tiếp nối."
        );
        setError(msg);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [tripId, page, pageSize]
  );

  useEffect(() => {
    if (!enabled || !tripId) return;

    const controller = new AbortController();
    fetchSuggestions(controller.signal);

    return () => {
      controller.abort();
    };
  }, [enabled, tripId, fetchSuggestions]);

  return {
    suggestions,
    isLoading,
    error,
    refetch: () => fetchSuggestions(),
  };
}
