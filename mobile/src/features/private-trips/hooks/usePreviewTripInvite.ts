import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { previewTripInvite } from "../services/private-trips.api";
import type { InvitePreviewData } from "../types";
import { getInviteErrorMessage } from "../utils/inviteErrorUtils";

export function usePreviewTripInvite(inviteCode?: string, autoFetch = true) {
  const [preview, setPreview] = useState<InvitePreviewData | null>(null);
  const [loading, setLoading] = useState(Boolean(autoFetch && inviteCode));
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fetchPreview = useCallback(
    async (code?: string) => {
      const targetCode = code || inviteCode;
      if (!targetCode) {
        setLoading(false);
        return null;
      }

      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const res = await previewTripInvite(targetCode);
        setPreview(res);
        return res;
      } catch (err: any) {
        const codeErr = err?.code ?? err?.response?.data?.error?.code ?? (err instanceof ApiError ? err.code : null);
        setErrorCode(codeErr ?? null);
        const msg = getInviteErrorMessage(err);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [inviteCode],
  );

  useEffect(() => {
    if (autoFetch && inviteCode) {
      void fetchPreview();
    }
  }, [autoFetch, inviteCode, fetchPreview]);

  return {
    preview,
    loading,
    error,
    errorCode,
    refetch: fetchPreview,
  };
}
