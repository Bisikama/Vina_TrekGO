import { ApiError } from "@/lib/api-client";
import { useCallback, useState } from "react";
import { leavePrivateTripRoom } from "../services/private-trips.api";
import type { LeaveTripResponse } from "../types";

export function useLeavePrivateTrip() {
  const [leaveResult, setLeaveResult] = useState<LeaveTripResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const leaveTrip = useCallback(
    async (
      tripId: string,
      expectedMemberVersion: number,
    ): Promise<LeaveTripResponse> => {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const res = await leavePrivateTripRoom(tripId, expectedMemberVersion);
        setLeaveResult(res);
        return res;
      } catch (err: any) {
        const codeErr = err instanceof ApiError ? err.code : null;
        setErrorCode(codeErr ?? null);
        const msg =
          err instanceof ApiError ? err.message : "Không thể rời khỏi chuyến đi.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    leaveTrip,
    leaveResult,
    loading,
    error,
    errorCode,
  };
}
