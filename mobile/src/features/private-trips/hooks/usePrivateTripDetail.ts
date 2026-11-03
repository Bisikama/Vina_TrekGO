import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { getPrivateTripDetail } from "../services/private-trips.api";
import type { PrivateTrip } from "../types";

export function usePrivateTripDetail(tripId?: string, autoFetch = true) {
  const [trip, setTrip] = useState<PrivateTrip | null>(null);
  const [loading, setLoading] = useState(Boolean(autoFetch && tripId));
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(
    async (id?: string) => {
      const targetId = id || tripId;
      if (!targetId) {
        setLoading(false);
        return null;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await getPrivateTripDetail(targetId);
        if (res && res.id) {
          setTrip(res);
          return res;
        }
        throw new Error("Không có dữ liệu.");
      } catch (err: any) {
        setTrip(null);
        setError(
          err instanceof ApiError
            ? err.message
            : err?.message || "Không thể tải chi tiết chuyến đi.",
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [tripId],
  );

  useEffect(() => {
    if (autoFetch && tripId) {
      void fetchDetail();
    }
  }, [autoFetch, tripId, fetchDetail]);

  return {
    trip,
    setTrip,
    loading,
    error,
    refetch: fetchDetail,
  };
}
