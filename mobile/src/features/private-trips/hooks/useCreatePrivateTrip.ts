import { ApiError } from "@/lib/api-client";
import { useCallback, useState } from "react";
import { createPrivateTrip } from "../services/private-trips.api";
import type { CreatePrivateTripPayload, PrivateTrip } from "../types";

export function useCreatePrivateTrip() {
  const [createdTrip, setCreatedTrip] = useState<PrivateTrip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTrip = useCallback(
    async (payload: CreatePrivateTripPayload): Promise<PrivateTrip> => {
      setLoading(true);
      setError(null);
      try {
        const res = await createPrivateTrip(payload);
        if (res && res.id) {
          setCreatedTrip(res);
          return res;
        }
        throw new Error("Không có phản hồi từ máy chủ");
      } catch (err: any) {


        const msg =
          err instanceof ApiError
            ? err.message
            : "Không thể tạo chuyến đi riêng.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setCreatedTrip(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    createTrip,
    createdTrip,
    loading,
    error,
    reset,
  };
}
