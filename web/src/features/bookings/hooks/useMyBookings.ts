'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { bookingApiService, getBookingErrorMessage } from '../services/booking.api';
import type { BookingListQuery, BookingSummary, PageResponse } from '../types/booking.types';

export function useMyBookings(initialQuery: BookingListQuery = {}) {
  const [page, setPage] = useState<number>(initialQuery.page || 1);
  const [status, setStatus] = useState<string>(initialQuery.status || '');
  const pageSize = initialQuery.pageSize || 10;

  const { data, error: swrError, isLoading, mutate } = useSWR<PageResponse<BookingSummary>>(
    ['my-bookings', page, pageSize, status],
    () =>
      bookingApiService.listMyBookings({
        page,
        pageSize,
        ...(status ? { status } : {}),
      }),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  const updateStatus = useCallback((newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
  }, []);

  const error = swrError
    ? getBookingErrorMessage(swrError, 'Không thể tải danh sách đặt chỗ của bạn.').message
    : null;

  return {
    bookings: data?.items || [],
    total: data?.total || 0,
    page: data?.page || page,
    pageSize: data?.pageSize || pageSize,
    isLoading: isLoading && !data,
    error,
    status,
    setStatus: updateStatus,
    setPage,
    refetch: () => mutate(),
  };
}
