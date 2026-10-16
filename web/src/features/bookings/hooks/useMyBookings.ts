'use client';

import { useCallback, useEffect, useState } from 'react';
import { bookingApiService, getBookingErrorMessage } from '../services/booking.api';
import type { BookingListQuery, BookingSummary, PageResponse } from '../types/booking.types';

export function useMyBookings(initialQuery: BookingListQuery = {}) {
  const [data, setData] = useState<PageResponse<BookingSummary> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(initialQuery.page || 1);
  const [status, setStatus] = useState<string>(initialQuery.status || '');

  const fetchBookings = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        const query: BookingListQuery = {
          page,
          pageSize: initialQuery.pageSize || 10,
          ...(status ? { status } : {}),
        };
        const result = await bookingApiService.listMyBookings(query, signal);
        setData(result);
        return result;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'CanceledError') return;
        const errInfo = getBookingErrorMessage(
          err,
          'Không thể tải danh sách đặt chỗ của bạn.'
        );
        setError(errInfo.message);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [initialQuery.pageSize, page, status]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchBookings(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchBookings]);

  const updateStatus = useCallback((newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
  }, []);

  return {
    bookings: data?.items || [],
    total: data?.total || 0,
    page: data?.page || page,
    pageSize: data?.pageSize || 10,
    isLoading,
    error,
    status,
    setStatus: updateStatus,
    setPage,
    refetch: () => fetchBookings(),
  };
}
