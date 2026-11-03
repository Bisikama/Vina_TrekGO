import { ApiError } from "@/lib/api-client";
import { useCallback, useState } from "react";
import { updatePrivateTrip } from "../services/private-trips.api";
import type { PrivateTrip, UpdatePrivateTripPayload } from "../types";

export function useUpdatePrivateTrip() {
  const [updatedTrip, setUpdatedTrip] = useState<PrivateTrip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateTrip = useCallback(
    async (
      tripId: string,
      payload: UpdatePrivateTripPayload,
    ): Promise<PrivateTrip> => {
      setLoading(true);
      setError(null);
      try {
        const res = await updatePrivateTrip(tripId, payload);
        setUpdatedTrip(res);
        return res;
      } catch (err: any) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Không thể cập nhật thông tin chuyến đi.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    updateTrip,
    updatedTrip,
    loading,
    error,
  };
}
