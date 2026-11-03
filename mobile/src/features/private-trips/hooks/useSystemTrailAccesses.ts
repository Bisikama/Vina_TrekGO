import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { getSystemTrailAccesses } from "../services/private-trips.api";

export function useSystemTrailAccesses(autoFetch = true) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchAccesses = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSystemTrailAccesses(page);
      const list = Array.isArray(res) ? res : [];
      setData(list);
      return list;
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Không thể tải danh sách cung đường hệ thống đã mua quyền.";
      setError(msg);
      setData([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      void fetchAccesses();
    }
  }, [autoFetch, fetchAccesses]);

  return {
    trailAccesses: data,
    loading,
    error,
    refetch: fetchAccesses,
  };
}
