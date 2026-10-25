"use client";

import { useState } from "react";
import {
  cancelLeaderTripRequest,
  closeLeaderTripRegistration,
  completeLeaderTrip,
  createLeaderPublicTrip,
  getLeaderTripErrorMessage,
  publishLeaderTrip,
  setLeaderTripCheckpoints,
  setLeaderTripTrails,
  startLeaderTrip,
  updateLeaderPublicTrip,
} from "../services/leader-public-trips.api";
import type {
  CancelTripInput,
  CreateLeaderPublicTripInput,
  LeaderTripView,
  PublishTripInput,
  SetTripCheckpointsInput,
  SetTripTrailsInput,
  UpdateLeaderPublicTripInput,
} from "../types/leader-trips";

export function useLeaderTripMutations() {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const resetError = () => setError(null);

  /**
   * Tạo chuyến đi nháp DRAFT
   */
  const createDraft = async (
    input: CreateLeaderPublicTripInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await createLeaderPublicTrip(input);
      return result;
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(err, "Không thể tạo chuyến đi nháp.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Cập nhật thông tin cơ bản chuyến đi
   */
  const updateTrip = async (
    tripId: string,
    input: UpdateLeaderPublicTripInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await updateLeaderPublicTrip(tripId, input);
      return result;
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(err, "Không thể cập nhật chuyến đi.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Gán / thay thế danh sách Checkpoint bắt buộc
   */
  const setCheckpoints = async (
    tripId: string,
    input: SetTripCheckpointsInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await setLeaderTripCheckpoints(tripId, input);
      return result;
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(
        err,
        "Không thể gán danh sách checkpoint cho chuyến đi."
      );
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Gán / thay thế danh sách Cung đường (System Trails)
   */
  const setTrails = async (
    tripId: string,
    input: SetTripTrailsInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await setLeaderTripTrails(tripId, input);
      return result;
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(
        err,
        "Không thể gán danh sách cung đường cho chuyến đi."
      );
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Xuất bản chuyến đi sang trạng thái OPEN
   */
  const publishTrip = async (
    tripId: string,
    input: PublishTripInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await publishLeaderTrip(tripId, input);
      return result;
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(
        err,
        "Chuyến đi chưa đủ điều kiện xuất bản hoặc đã xảy ra lỗi."
      );
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Đóng form đăng ký sớm (OPEN / FULL -> CLOSED)
   */
  const closeRegistration = async (
    tripId: string,
    input: PublishTripInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      return await closeLeaderTripRegistration(tripId, input);
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(
        err,
        "Không thể đóng form đăng ký."
      );
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Bắt đầu hành trình (OPEN / FULL / CLOSED -> IN_PROGRESS)
   */
  const startTrip = async (
    tripId: string,
    input: PublishTripInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      return await startLeaderTrip(tripId, input);
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(
        err,
        "Không thể bắt đầu chuyến đi."
      );
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Hoàn thành hành trình (IN_PROGRESS -> COMPLETED)
   */
  const completeTrip = async (
    tripId: string,
    input: PublishTripInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      return await completeLeaderTrip(tripId, input);
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(
        err,
        "Không thể hoàn thành chuyến đi."
      );
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Gửi yêu cầu hủy chuyến đi
   */
  const cancelTrip = async (
    tripId: string,
    input: CancelTripInput
  ): Promise<LeaderTripView> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await cancelLeaderTripRequest(tripId, input);
      return result;
    } catch (err: unknown) {
      const msg = getLeaderTripErrorMessage(
        err,
        "Không thể gửi yêu cầu hủy chuyến đi."
      );
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isSubmitting,
    error,
    resetError,
    createDraft,
    updateTrip,
    setCheckpoints,
    setTrails,
    publishTrip,
    closeRegistration,
    startTrip,
    completeTrip,
    cancelTrip,
  };
}
