import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { getPickupPoints } from "../services/private-trips.api";
import type { PickupPointOption } from "../types";

export function usePickupPoints(destinationId?: string, autoFetch = true) {
  const [pickupPoints, setPickupPoints] = useState<PickupPointOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPickupPoints = useCallback(
    async (destId?: string, page = 1) => {
      const targetId = destId || destinationId;
      if (!targetId) {
        setPickupPoints([]);
        return [];
      }

      setLoading(true);
      setError(null);
      try {
        const res = await getPickupPoints(targetId, page);
        const points = Array.isArray(res) ? res : [];
        setPickupPoints(points);
        return points;
      } catch (err: any) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Không thể tải danh sách điểm tập kết.";
        setError(msg);
        setPickupPoints([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [destinationId],
  );

  useEffect(() => {
    if (autoFetch && destinationId) {
      void fetchPickupPoints();
    }
  }, [autoFetch, destinationId, fetchPickupPoints]);

  return {
    pickupPoints,
    loading,
    error,
    fetchPickupPoints,
  };
}
