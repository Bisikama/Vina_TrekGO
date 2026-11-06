import { useCallback, useEffect, useRef, useState } from "react";
import {
  bookingApiService,
  getBookingErrorMessage,
} from "../services/booking.api";
import type { BookingDetail } from "../types";

export function useBookingDetail(
  bookingId: string | null | undefined,
  enablePolling = true,
  isPaused = false,
) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(bookingId));
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const active = useRef(true);
  const generation = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const fetchDetail = useCallback(async () => {
    const request = ++generation.current;
    if (!bookingId) {
      setBooking(null);
      setIsLoading(false);
      return;
    }

    try {
      const result = await bookingApiService.getBookingDetail(bookingId);
      if (!active.current || request !== generation.current) return;
      setBooking(result);
      setError(null);
      return result;
    } catch (err: unknown) {
      if (!active.current || request !== generation.current) return;
      const errInfo = getBookingErrorMessage(
        err,
        "Không thể tải thông tin đặt chỗ.",
      );
      setError(errInfo.message);
      return undefined;
    } finally {
      if (active.current && request === generation.current) setIsLoading(false);
    }
  }, [bookingId]);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    void fetchDetail();
  }, [fetchDetail]);

  // Hold expiration countdown timer (tam dung khi dang cho xac nhan thanh toan)
  useEffect(() => {
    if (!booking?.expiresAt || booking.status !== "PENDING_PAYMENT") {
      setRemainingSeconds(0);
      return;
    }

    if (isPaused) {
      // Khi nut dang cho xac nhan dang xoay, dong bang dong ho dem nguoc
      return;
    }

    const calculateRemaining = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(booking.expiresAt).getTime() - Date.now()) / 1000),
      );
      setRemainingSeconds(diff);
      return diff;
    };

    calculateRemaining();
    const interval = setInterval(() => {
      const rem = calculateRemaining();
      if (rem <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [booking?.expiresAt, booking?.status, isPaused]);

  // Auto-polling when PENDING_PAYMENT to detect payment completion
  useEffect(() => {
    if (!enablePolling || !bookingId) return;

    if (booking?.status === "PENDING_PAYMENT" && booking.trip.status !== 'CANCEL_PENDING') {
      const expiresTime = booking.expiresAt
        ? new Date(booking.expiresAt).getTime()
        : Infinity;

      const interval = setInterval(async () => {
        if (Date.now() > expiresTime) {
          clearInterval(interval);
          return;
        }
        await fetchDetail();
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [booking?.status, booking?.trip.status, booking?.expiresAt, bookingId, enablePolling, fetchDetail]);

  return {
    booking,
    setBooking,
    isLoading,
    error,
    remainingSeconds,
    isHoldExpired:
      booking?.status === "PENDING_PAYMENT" && remainingSeconds <= 0,
    refetch: fetchDetail,
  };
}
