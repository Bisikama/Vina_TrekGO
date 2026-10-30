import { useCallback, useState } from "react";
import {
  checkScheduleConflict,
  createPublicTrip,
  getCheckpointOptions,
  getDestinations,
  getLeaderTrips,
  getPickupPoints,
  getTrailSuggestions,
  getTripReadiness,
  publishTrip,
  setTripCheckpoints,
  setTripTrails,
  updatePublicTrip,
  getLeaderPublicTripById,
  requestTripCancellation,
  type CreatePublicTripInput,
  type UpdatePublicTripInput,
  type RequestCancellationInput,
  type LeaderPublicTrip,
  type LeaderTrailSuggestion,
  type ReadinessCheckResponse,
  type ScheduleConflictResponse,
  type SetCheckpointsInput,
  type SetTrailsInput,
  type TripOptionCheckpoint,
  type TripOptionDestination,
  type TripOptionPickupPoint,
} from "@/features/leaders/services/leader-public-trips.api";
import { ApiError } from "@/lib/api-client";

export function useLeaderTrips(accessToken?: string | null) {
  const [trips, setTrips] = useState<LeaderPublicTrip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyTrips = useCallback(
    async (targetPage = 1, targetPageSize = 20, isLoadMore = false) => {
      if (!accessToken) return;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await getLeaderTrips(accessToken, targetPage, targetPageSize);
        if (isLoadMore) {
          setTrips((prev) => [...prev, ...(res.items ?? [])]);
        } else {
          setTrips(res.items ?? []);
        }
        setTotal(res.total ?? (res.items?.length || 0));
        setPage(res.page ?? targetPage);
        setPageSize(res.pageSize ?? targetPageSize);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Không thể tải danh sách chuyến của bạn.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken],
  );

  const cancelTrip = useCallback(
    async (
      tripId: string,
      input: RequestCancellationInput,
    ): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      setLoading(true);
      setError(null);
      try {
        const res = await requestTripCancellation(tripId, input, accessToken);
        await fetchMyTrips();
        return res;
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Gửi yêu cầu hủy chuyến thất bại.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken, fetchMyTrips],
  );

  const getTripById = useCallback(
    async (tripId: string): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      return getLeaderPublicTripById(tripId, accessToken);
    },
    [accessToken],
  );

  const updateTrip = useCallback(
    async (tripId: string, input: UpdatePublicTripInput): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      setLoading(true);
      setError(null);
      try {
        const res = await updatePublicTrip(tripId, input, accessToken);
        await fetchMyTrips();
        return res;
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Cập nhật chuyến đi thất bại.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken, fetchMyTrips],
  );

  return {
    trips,
    total,
    page,
    pageSize,
    loading,
    loadingMore,
    error,
    fetchMyTrips,
    cancelTrip,
    getTripById,
    updateTrip,
  };
}

export function useLeaderTripCreation(accessToken?: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDestinations = useCallback(async (): Promise<TripOptionDestination[]> => {
    if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
    return getDestinations(accessToken);
  }, [accessToken]);

  const loadPickupPoints = useCallback(
    async (destId: string): Promise<TripOptionPickupPoint[]> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      const res = await getPickupPoints(destId, accessToken);
      return Array.isArray(res) ? res : ((res as any)?.items ?? []);
    },
    [accessToken],
  );

  const loadCheckpoints = useCallback(
    async (destId: string): Promise<TripOptionCheckpoint[]> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      const res = await getCheckpointOptions(destId, accessToken);
      return Array.isArray(res) ? res : ((res as any)?.items ?? []);
    },
    [accessToken],
  );

  const checkConflict = useCallback(
    async (
      startAt: string,
      endAt: string,
      excludeTripId?: string,
    ): Promise<ScheduleConflictResponse> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      return checkScheduleConflict(startAt, endAt, accessToken, excludeTripId);
    },
    [accessToken],
  );

  const createTrip = useCallback(
    async (input: CreatePublicTripInput): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      setLoading(true);
      setError(null);
      try {
        return await createPublicTrip(input, accessToken);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Tạo chuyến đi thất bại.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  const assignCheckpoints = useCallback(
    async (tripId: string, input: SetCheckpointsInput): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      setLoading(true);
      setError(null);
      try {
        return await setTripCheckpoints(tripId, input, accessToken);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Gán checkpoint thất bại.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  const loadTrailSuggestions = useCallback(
    async (tripId: string): Promise<LeaderTrailSuggestion[]> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      const res = await getTrailSuggestions(tripId, accessToken);
      if (Array.isArray(res)) return res;
      if (res && Array.isArray((res as any).items)) return (res as any).items;
      return [];
    },
    [accessToken],
  );

  const assignTrails = useCallback(
    async (tripId: string, input: SetTrailsInput): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      setLoading(true);
      setError(null);
      try {
        return await setTripTrails(tripId, input, accessToken);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Gán cung đường thất bại.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  const checkReadiness = useCallback(
    async (tripId: string): Promise<ReadinessCheckResponse> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      return getTripReadiness(tripId, accessToken);
    },
    [accessToken],
  );

  const publish = useCallback(
    async (tripId: string, expectedVersion: number): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      setLoading(true);
      setError(null);
      try {
        return await publishTrip(tripId, { expectedVersion }, accessToken);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Xuất bản chuyến đi thất bại.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  const updateTrip = useCallback(
    async (tripId: string, input: UpdatePublicTripInput): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      setLoading(true);
      setError(null);
      try {
        return await updatePublicTrip(tripId, input, accessToken);
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Cập nhật chuyến đi thất bại.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  const getTripById = useCallback(
    async (tripId: string): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      return getLeaderPublicTripById(tripId, accessToken);
    },
    [accessToken],
  );

  const cancelTrip = useCallback(
    async (
      tripId: string,
      input: RequestCancellationInput,
    ): Promise<LeaderPublicTrip> => {
      if (!accessToken) throw new Error("Chưa có phiên đăng nhập.");
      setLoading(true);
      setError(null);
      try {
        return await requestTripCancellation(tripId, input, accessToken);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : "Gửi yêu cầu hủy chuyến thất bại.";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  return {
    loading,
    error,
    loadDestinations,
    loadPickupPoints,
    loadCheckpoints,
    checkConflict,
    createTrip,
    updateTrip,
    getTripById,
    assignCheckpoints,
    loadTrailSuggestions,
    assignTrails,
    checkReadiness,
    publish,
    cancelTrip,
  };
}
