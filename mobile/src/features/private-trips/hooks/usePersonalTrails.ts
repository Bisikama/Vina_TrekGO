import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { getPersonalTrails } from "../services/private-trips.api";

export function usePersonalTrails(autoFetch = true) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchTrails = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPersonalTrails(page);
      setData(res ?? []);
      return res;
    } catch (err: any) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Không thể tải danh sách cung đường cá nhân.";
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      void fetchTrails();
    }
  }, [autoFetch, fetchTrails]);

  return {
    personalTrails: data,
    loading,
    error,
    refetch: fetchTrails,
  };
}
