'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { bookingApiService, getBookingErrorMessage } from '../services/booking.api';
import type { PageResponse, PublicBookingTrip, PublicTripsQuery } from '../types/booking.types';

export function usePublicBookingTrips(initialQuery: PublicTripsQuery = {}) {
  const [page, setPage] = useState<number>(initialQuery.page || 1);
  const [filters, setFilters] = useState<Omit<PublicTripsQuery, 'page'>>(initialQuery);

  const pageSize = filters.pageSize || 12;
  const swrKey = [
    'public-booking-trips',
    page,
    pageSize,
    filters.keyword || '',
    filters.difficulty || '',
    filters.destinationId || '',
    filters.dateFrom || '',
    filters.dateTo || '',
    filters.priceMax ?? '',
  ] as const;

  const { data, error: swrError, isLoading, mutate } = useSWR<PageResponse<PublicBookingTrip>>(
    swrKey,
    () =>
      bookingApiService.getPublicTrips({
        ...filters,
        page,
        pageSize,
      }),
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  const updateFilters = useCallback((newFilters: Partial<PublicTripsQuery>) => {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  const error = swrError
    ? getBookingErrorMessage(swrError, 'Không thể tải danh sách chuyến đi.').message
    : null;

  return {
    trips: data?.items || [],
    total: data?.total || 0,
    page: data?.page || page,
    pageSize: data?.pageSize || pageSize,
    isLoading: isLoading && !data,
    error,
    setPage,
    setFilters: updateFilters,
    refetch: () => mutate(),
  };
}
