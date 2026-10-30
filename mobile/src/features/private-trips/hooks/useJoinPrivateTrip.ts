import { ApiError } from "@/lib/api-client";
import { useCallback, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { joinPrivateTripByCode } from "../services/private-trips.api";
import type { JoinTripResponse } from "../types";

export function useJoinPrivateTrip(explicitAccessToken?: string | null) {
  const { accessToken: contextToken } = useAuth();
  const token = explicitAccessToken !== undefined ? explicitAccessToken : contextToken;

  const [joinResult, setJoinResult] = useState<JoinTripResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const joinTrip = useCallback(
    async (code: string): Promise<JoinTripResponse> => {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const res = await joinPrivateTripByCode(code, token || undefined);
        setJoinResult(res);
        return res;
      } catch (err: any) {
        const codeErr = err instanceof ApiError ? err.code : null;
        setErrorCode(codeErr ?? null);
        const msg =
          err instanceof ApiError ? err.message : "Không thể tham gia chuyến đi.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  return {
    joinTrip,
    joinResult,
    loading,
    error,
    errorCode,
  };
}
