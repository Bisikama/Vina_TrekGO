"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  cancelLeaderTripRequest,
  createLeaderPublicTrip,
  getLeaderCheckpointOptions,
  getLeaderDestinationOptions,
  getLeaderPickupPointOptions,
  getLeaderPublicTripDetail,
  getLeaderTrailSuggestions,
  getLeaderTripErrorMessage,
  getLeaderTripReadiness,
  listLeaderPublicTrips,
  publishLeaderTrip,
  setLeaderTripCheckpoints,
  setLeaderTripTrails,
  updateLeaderPublicTrip,
} from "@/features/leaders/services/leader-public-trips.api";
import type {
  CreateLeaderPublicTripInput,
  LeaderCheckpointOption,
  LeaderTripView,
  TrailSuggestion,
  TripOptionItem,
  TripReadinessResult,
} from "@/features/leaders/types/leader-trips";

export function usePublicTrips() {
  const { accessToken: token, user } = useAuthStore();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [trailPage, setTrailPage] = useState(1);

  const [trips, setTrips] = useState<LeaderTripView[]>([]);
  const [trip, setTrip] = useState<LeaderTripView | null>(null);

  const [destinations, setDestinations] = useState<TripOptionItem[]>([]);
  const [pickups, setPickups] = useState<TripOptionItem[]>([]);
  const [checkpoints, setCheckpoints] = useState<LeaderCheckpointOption[]>([]);
  const [trails, setTrails] = useState<TrailSuggestion[]>([]);
  const [readiness, setReadiness] = useState<TripReadinessResult | null>(null);

  // 1. Tải danh mục Destinations
  const loadDestinations = useCallback(async () => {
    try {
      const data = await getLeaderDestinationOptions({ page: 1, pageSize: 100 });
      setDestinations(data);
    } catch {
      // Ignored if offline/unauthorized
    }
  }, []);

  // 2. Tải danh sách trips của Leader
  const loadTrips = useCallback(async (p = page) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const data = await listLeaderPublicTrips({ page: p, pageSize: 20 });
      setTrips(data);
      setPage(p);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể tải danh sách chuyến đi."));
    } finally {
      setBusy(false);
    }
  }, [token, page]);

  // 3. Tải Pickups và Checkpoints theo Destination
  const loadDestination = useCallback(async (destId: string) => {
    if (!destId) {
      setPickups([]);
      setCheckpoints([]);
      return;
    }
    try {
      const [pickupData, checkpointData] = await Promise.all([
        getLeaderPickupPointOptions(destId, { page: 1, pageSize: 100 }),
        getLeaderCheckpointOptions(destId, { page: 1, pageSize: 100 }),
      ]);
      setPickups(pickupData);
      setCheckpoints(checkpointData);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể tải dữ liệu điểm đến."));
    }
  }, []);

  // 4. Mở chi tiết 1 chuyến đi
  const open = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setReadiness(null);
    try {
      const detail = await getLeaderPublicTripDetail(id);
      setTrip(detail);
      if (detail.destinationId) {
        await loadDestination(detail.destinationId);
      }
      const suggestions = await getLeaderTrailSuggestions(id, { page: 1, pageSize: 20 });
      setTrails(suggestions);
      setTrailPage(1);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể tải chi tiết chuyến đi."));
    } finally {
      setBusy(false);
    }
  }, [loadDestination]);

  // 5. Tải trang gợi ý trail tiếp theo
  const suggestionsPage = useCallback(async (p: number) => {
    if (!trip) return;
    setBusy(true);
    try {
      const suggestions = await getLeaderTrailSuggestions(trip.id, { page: p, pageSize: 20 });
      setTrails(suggestions);
      setTrailPage(p);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể tải gợi ý cung đường."));
    } finally {
      setBusy(false);
    }
  }, [trip]);

  // 6. Lưu thông tin chuyến đi (Tạo mới hoặc Cập nhật)
  const save = async (data: CreateLeaderPublicTripInput) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (trip) {
        const updated = await updateLeaderPublicTrip(trip.id, {
          expectedVersion: trip.version,
          ...data,
        });
        setTrip(updated);
        setNotice("Đã lưu cập nhật thông tin chuyến đi thành công.");
      } else {
        const created = await createLeaderPublicTrip(data);
        setTrip(created);
        setNotice("Đã tạo chuyến đi nháp thành công.");
        await open(created.id);
      }
      await loadTrips(page);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể lưu chuyến đi."));
    } finally {
      setBusy(false);
    }
  };

  // 7. Gán Checkpoints
  const setCheckpointIds = async (ids: string[]) => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await setLeaderTripCheckpoints(trip.id, {
        expectedVersion: trip.version,
        checkpointIds: ids,
      });
      setTrip(updated);
      setNotice("Đã cập nhật danh sách checkpoint bắt buộc.");
      const suggestions = await getLeaderTrailSuggestions(trip.id, { page: trailPage, pageSize: 20 });
      setTrails(suggestions);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể cập nhật checkpoints."));
    } finally {
      setBusy(false);
    }
  };

  // 8. Gán Trails
  const setTrailIds = async (ids: string[]) => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await setLeaderTripTrails(trip.id, {
        expectedVersion: trip.version,
        trailIds: ids,
      });
      setTrip(updated);
      setNotice("Đã cập nhật cung đường dự kiến.");
      const suggestions = await getLeaderTrailSuggestions(trip.id, { page: trailPage, pageSize: 20 });
      setTrails(suggestions);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể cập nhật cung đường."));
    } finally {
      setBusy(false);
    }
  };

  // 9. Kiểm tra tính sẵn sàng (Review)
  const review = async () => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      const result = await getLeaderTripReadiness(trip.id);
      setReadiness(result);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể kiểm tra điều kiện xuất bản."));
    } finally {
      setBusy(false);
    }
  };

  // 10. Xuất bản (Publish)
  const publish = async () => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await publishLeaderTrip(trip.id, { expectedVersion: trip.version });
      setTrip(updated);
      setNotice("🎉 Xuất bản chuyến đi thành công! Chuyến đi đã mở nhận đăng ký.");
      await loadTrips(page);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể xuất bản chuyến đi."));
    } finally {
      setBusy(false);
    }
  };

  // 11. Hủy chuyến đi (Cancel)
  const cancel = async (cancelReason: string) => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await cancelLeaderTripRequest(trip.id, {
        expectedVersion: trip.version,
        reason: cancelReason,
      });
      setTrip(updated);
      setNotice("Đã gửi yêu cầu hủy chuyến đi.");
      await loadTrips(page);
    } catch (err: unknown) {
      setError(getLeaderTripErrorMessage(err, "Không thể gửi yêu cầu hủy chuyến đi."));
    } finally {
      setBusy(false);
    }
  };

  const newDraft = () => {
    setTrip(null);
    setReadiness(null);
    setNotice(null);
    setError(null);
  };

  const refresh = () => {
    if (trip) {
      open(trip.id);
    } else {
      loadTrips(page);
    }
  };

  const listPage = (p: number) => {
    loadTrips(p);
  };

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  useEffect(() => {
    if (token) {
      loadTrips(1);
    }
  }, [token, loadTrips]);

  return {
    token,
    user,
    busy,
    error,
    notice,
    trips,
    trip,
    page,
    trailPage,
    destinations,
    pickups,
    checkpoints,
    trails,
    readiness,
    listPage,
    suggestionsPage,
    newDraft,
    open,
    refresh,
    loadDestination,
    save,
    setCheckpointIds,
    setTrailIds,
    review,
    publish,
    cancel,
  };
}
