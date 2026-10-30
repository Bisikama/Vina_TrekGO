import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPublicTrips,
  type PublicTrip,
  type PublicTripsFilter,
} from "@/features/trips/services/public-trips.api";
import { ApiError } from "@/lib/api-client";

export interface UsePublicTripsOptions {
  initialFilter?: PublicTripsFilter;
  pageSize?: number;
  autoFetch?: boolean;
}

export function usePublicTrips(options: UsePublicTripsOptions = {}) {
  const { initialFilter = {}, pageSize = 12, autoFetch = true } = options;

  const [trips, setTrips] = useState<PublicTrip[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilterState] = useState<PublicTripsFilter>({
    pageSize,
    page: 1,
    ...initialFilter,
  });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchTrips = useCallback(
    async (
      targetPage: number,
      activeFilter: PublicTripsFilter,
      mode: "init" | "refresh" | "more" = "init",
    ) => {
      if (mode === "init") setLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "more") setLoadingMore(true);
      setError(null);

      try {
        const response = await getPublicTrips({
          ...activeFilter,
          page: targetPage,
          pageSize: activeFilter.pageSize || pageSize,
        });

        if (!isMountedRef.current) return;

        const newItems = response.items ?? [];
        const totalCount = response.total ?? newItems.length;
        setTotal(totalCount);
        setPage(targetPage);
        // getPublicTrips đã tự gom đủ các trang → chỉ còn trang khi trang 1 chưa đủ total
        setHasMore(targetPage === 1 && newItems.length > 0 && newItems.length < totalCount);

        setTrips((prev) => (targetPage === 1 ? newItems : [...prev, ...newItems]));
      } catch (err) {
        if (!isMountedRef.current) return;
        const msg =
          err instanceof ApiError
            ? err.message
            : "Không thể tải danh sách chuyến đi.";
        setError(msg);
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [pageSize],
  );

  // Initial & Filter changes trigger fetch
  useEffect(() => {
    if (autoFetch) {
      void fetchTrips(1, filter, "init");
    }
  }, [filter, autoFetch, fetchTrips]);

  const refresh = useCallback(async () => {
    await fetchTrips(1, filter, "refresh");
  }, [fetchTrips, filter]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    await fetchTrips(page + 1, filter, "more");
  }, [fetchTrips, filter, hasMore, loading, loadingMore, page]);

  const updateFilter = useCallback(
    (newFilter: Partial<PublicTripsFilter>) => {
      setFilterState((prev) => ({
        ...prev,
        ...newFilter,
        page: 1,
      }));
    },
    [],
  );

  const setDifficulty = useCallback(
    (difficulty?: string) => {
      updateFilter({
        difficulty: !difficulty || difficulty === "Tất cả" ? undefined : difficulty,
      });
    },
    [updateFilter],
  );

  return {
    trips,
    total,
    page,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    error,
    filter,
    refresh,
    loadMore,
    updateFilter,
    setDifficulty,
  };
}
