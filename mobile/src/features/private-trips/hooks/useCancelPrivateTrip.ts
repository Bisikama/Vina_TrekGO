import { ApiError } from "@/lib/api-client";
import { useCallback, useState } from "react";
import { cancelPrivateTrip } from "../services/private-trips.api";
import type { PrivateTrip } from "../types";

export function useCancelPrivateTrip() {
  const [cancelledTrip, setCancelledTrip] = useState<PrivateTrip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelTrip = useCallback(
    async (
      tripId: string,
      expectedVersion: number,
      reason: string,
    ): Promise<PrivateTrip> => {
      setLoading(true);
      setError(null);
      try {
        const res = await cancelPrivateTrip(tripId, expectedVersion, reason);
        setCancelledTrip(res);
        return res;
      } catch (err: any) {
        const msg =
          err instanceof ApiError ? err.message : "Không thể hủy chuyến đi.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    cancelTrip,
    cancelledTrip,
    loading,
    error,
  };
}
