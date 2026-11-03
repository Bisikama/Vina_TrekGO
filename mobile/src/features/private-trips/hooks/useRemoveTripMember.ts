import { ApiError } from "@/lib/api-client";
import { useCallback, useState } from "react";
import { removePrivateTripMember } from "../services/private-trips.api";
import type { RemoveMemberResponse } from "../types";

export function useRemoveTripMember() {
  const [removeResult, setRemoveResult] = useState<RemoveMemberResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const removeMember = useCallback(
    async (
      tripId: string,
      memberId: string,
      expectedMemberVersion: number,
    ): Promise<RemoveMemberResponse> => {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const res = await removePrivateTripMember(
          tripId,
          memberId,
          expectedMemberVersion,
        );
        setRemoveResult(res);
        return res;
      } catch (err: any) {
        const codeErr = err instanceof ApiError ? err.code : null;
        setErrorCode(codeErr ?? null);
        const msg =
          err instanceof ApiError ? err.message : "Không thể loại thành viên.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    removeMember,
    removeResult,
    loading,
    error,
    errorCode,
  };
}
