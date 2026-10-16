"use client";

import { useCallback, useState } from "react";
import { checkTrailAccess } from "../services/system-trails.api";

export function useTrailAccess() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [hasAccess, setHasAccess] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const verifyAccess = useCallback(async (trailId: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await checkTrailAccess(trailId);
      setHasAccess(result.hasAccess);
      setExpiresAt(result.expiresAt || null);
      return result;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể kiểm tra quyền truy cập bản đồ.");
      setHasAccess(false);
      setExpiresAt(null);
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    busy,
    error,
    hasAccess,
    expiresAt,
    verifyAccess
  };
}
