"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkLeaderScheduleConflicts,
  getLeaderCheckpointOptions,
  getLeaderDestinationOptions,
  getLeaderPickupPointOptions,
  getLeaderSystemTrailOption,
  getLeaderTripErrorMessage,
} from "../services/leader-public-trips.api";
import type {
  LeaderCheckpointOption,
  LeaderTrailDetail,
  ScheduleConflictQuery,
  ScheduleConflictResult,
  TripOptionItem,
} from "../types/leader-trips";

export function useLeaderTripOptions() {
  const [destinations, setDestinations] = useState<TripOptionItem[]>([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState<boolean>(false);
  const [destinationError, setDestinationError] = useState<string | null>(null);

  /**
   * Tải danh sách các Điểm đến (Destinations)
   */
  const fetchDestinations = useCallback(async (signal?: AbortSignal) => {
    setIsLoadingDestinations(true);
    setDestinationError(null);
    try {
      const data = await getLeaderDestinationOptions({ page: 1, pageSize: 100 }, signal);
      setDestinations(data);
      return data;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      const msg = getLeaderTripErrorMessage(err, "Không thể tải danh sách điểm đến.");
      setDestinationError(msg);
      return [];
    } finally {
      setIsLoadingDestinations(false);
    }
  }, []);

  /**
   * Tải danh sách Điểm tập kết / đón xe theo destinationId
   */
  const fetchPickups = useCallback(
    async (destinationId: string, signal?: AbortSignal): Promise<TripOptionItem[]> => {
      if (!destinationId) return [];
      try {
        return await getLeaderPickupPointOptions(destinationId, { page: 1, pageSize: 100 }, signal);
      } catch (err: unknown) {
        throw new Error(getLeaderTripErrorMessage(err, "Không thể tải danh sách điểm đón xe."));
      }
    },
    []
  );

  /**
   * Tải danh sách Checkpoints chính thức theo destinationId
   */
  const fetchCheckpoints = useCallback(
    async (destinationId: string, signal?: AbortSignal): Promise<LeaderCheckpointOption[]> => {
      if (!destinationId) return [];
      try {
        return await getLeaderCheckpointOptions(destinationId, { page: 1, pageSize: 100 }, signal);
      } catch (err: unknown) {
        throw new Error(getLeaderTripErrorMessage(err, "Không thể tải danh sách checkpoint."));
      }
    },
    []
  );

  /**
   * Lấy chi tiết GeoJSON và độ khó của một System Trail
   */
  const fetchTrailDetail = useCallback(
    async (trailId: string, signal?: AbortSignal): Promise<LeaderTrailDetail> => {
      if (!trailId) throw new Error("Cần trailId hợp lệ.");
      try {
        return await getLeaderSystemTrailOption(trailId, signal);
      } catch (err: unknown) {
        throw new Error(getLeaderTripErrorMessage(err, "Không thể tải chi tiết cung đường."));
      }
    },
    []
  );

  /**
   * Kiểm tra xem Leader có bị trùng lịch với chuyến đi khác không
   */
  const checkConflicts = useCallback(
    async (query: ScheduleConflictQuery, signal?: AbortSignal): Promise<ScheduleConflictResult> => {
      try {
        return await checkLeaderScheduleConflicts(query, signal);
      } catch (err: unknown) {
        throw new Error(getLeaderTripErrorMessage(err, "Không thể kiểm tra trùng lịch."));
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDestinations(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchDestinations]);

  return {
    destinations,
    isLoadingDestinations,
    destinationError,
    fetchDestinations,
    fetchPickups,
    fetchCheckpoints,
    fetchTrailDetail,
    checkConflicts,
  };
}
