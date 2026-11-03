import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { getPrivateTripRoom } from "../services/private-trips.api";
import type { TripRoomData } from "../types";

export function usePrivateTripRoom(tripId?: string, autoFetch = true) {
  const [roomData, setRoomData] = useState<TripRoomData | null>(null);
  const [loading, setLoading] = useState(Boolean(autoFetch && tripId));
  const [error, setError] = useState<string | null>(null);

  const fetchRoom = useCallback(
    async (id?: string) => {
      const targetId = id || tripId;
      if (!targetId) {
        setLoading(false);
        return null;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await getPrivateTripRoom(targetId);
        if (res && res.trip) {
          setRoomData(res);
          return res;
        }
        throw new Error("Không có dữ liệu.");
      } catch (err: any) {
        setRoomData(null);
        setError(
          err instanceof ApiError
            ? err.message
            : err?.message || "Không thể tải phòng chờ chuyến đi.",
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
      void fetchRoom();
    }
  }, [autoFetch, tripId, fetchRoom]);

  return {
    roomData,
    setRoomData,
    loading,
    error,
    refetch: fetchRoom,
  };
}
