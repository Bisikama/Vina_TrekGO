import { ApiError } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { getPrivateTripMembers } from "../services/private-trips.api";
import type { TripMember } from "../types";

export function usePrivateTripMembers(
  tripId?: string,
  initialParams: { page?: number; pageSize?: number; status?: "ACTIVE" | "ALL" | string } = {
    status: "ACTIVE",
  },
  autoFetch = true,
) {
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "ALL">(
    (initialParams.status as "ACTIVE" | "ALL") || "ACTIVE",
  );
  const [members, setMembers] = useState<TripMember[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [capacity, setCapacity] = useState(0);
  const [loading, setLoading] = useState(Boolean(autoFetch && tripId));
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(
    async (id?: string, overrideStatus?: "ACTIVE" | "ALL") => {
      const targetId = id || tripId;
      if (!targetId) {
        setLoading(false);
        return null;
      }

      setLoading(true);
      setError(null);
      try {
        const queryParams = {
          page: initialParams.page || 1,
          pageSize: initialParams.pageSize || 50,
          status: overrideStatus || statusFilter,
        };
        const res = await getPrivateTripMembers(targetId, queryParams);
        setMembers(res.items ?? []);
        setTotal(res.total ?? 0);
        setActiveCount(res.activeMemberCount ?? 0);
        setCapacity(res.capacity ?? 0);
        return res;
      } catch (err: any) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Không thể tải danh sách thành viên.";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [tripId, initialParams.page, initialParams.pageSize, statusFilter],
  );

  useEffect(() => {
    if (autoFetch && tripId) {
      void fetchMembers();
    }
  }, [autoFetch, tripId, fetchMembers]);

  return {
    members,
    total,
    activeCount,
    capacity,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    refetch: fetchMembers,
  };
}
