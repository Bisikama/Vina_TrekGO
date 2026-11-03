import { ApiError } from "@/lib/api-client";
import { useCallback, useState } from "react";
import {
  createTripInvite,
  revokeTripInvite,
} from "../services/private-trips.api";
import type { CreateInviteResponse } from "../types";

export function useTripInvitation() {
  const [inviteData, setInviteData] = useState<CreateInviteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInvite = useCallback(
    async (
      tripId: string,
      expectedVersion: number,
      expiresAt?: string,
    ): Promise<CreateInviteResponse> => {
      setLoading(true);
      setError(null);
      try {
        const res = await createTripInvite(tripId, expectedVersion, expiresAt);
        setInviteData(res);
        return res;
      } catch (err: any) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Không thể tạo mã mời bạn bè.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const revokeInvite = useCallback(
    async (
      tripId: string,
      expectedVersion: number,
    ): Promise<{ tripId: string; revokedCount: number; tripVersion: number }> => {
      setLoading(true);
      setError(null);
      try {
        const res = await revokeTripInvite(tripId, expectedVersion);
        setInviteData(null);
        return res;
      } catch (err: any) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Không thể thu hồi mã mời.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    inviteData,
    loading,
    error,
    generateInvite,
    revokeInvite,
  };
}
