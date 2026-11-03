import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { getMyPrivateTrips } from "../services/private-trips.api";
import type { PrivateTrip } from "../types";

export function useMyPrivateTrips(autoFetch = true) {
  const [trips, setTrips] = useState<PrivateTrip[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyPrivateTrips(page);
      setTrips(res ?? []);
      return res;
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Không thể tải danh sách chuyến đi của bạn.";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      void fetchTrips();
    }
  }, [autoFetch, fetchTrips]);

  return {
    trips,
    loading,
    error,
    refetch: fetchTrips,
  };
}
