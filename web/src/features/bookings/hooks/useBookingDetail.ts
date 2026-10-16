'use client';

import { useCallback, useEffect, useState } from 'react';
import { bookingApiService, getBookingErrorMessage } from '../services/booking.api';
import type { BookingDetail } from '../types/booking.types';

export function useBookingDetail(bookingId: string | null | undefined) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(bookingId));
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const fetchDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!bookingId) {
        setBooking(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const result = await bookingApiService.getBookingDetail(bookingId, signal);
        setBooking(result);
        return result;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'CanceledError') return;
        const errInfo = getBookingErrorMessage(err, 'Không thể tải thông tin đặt chỗ.');
        setError(errInfo.message);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [bookingId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchDetail]);

  // Cập nhật bộ đếm ngược hạn giữ chỗ (hold expiration timer)
  useEffect(() => {
    if (!booking?.expiresAt || booking.status !== 'PENDING_PAYMENT') {
      setRemainingSeconds(0);
      return;
    }

    const calculateRemaining = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(booking.expiresAt).getTime() - Date.now()) / 1000)
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
  }, [booking?.expiresAt, booking?.status]);

  return {
    booking,
    isLoading,
    error,
    remainingSeconds,
    isHoldExpired: booking?.status === 'PENDING_PAYMENT' && remainingSeconds <= 0,
    refetch: () => fetchDetail(),
  };
}
