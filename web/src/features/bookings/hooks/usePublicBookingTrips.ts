'use client';

import { useCallback, useEffect, useState } from 'react';
import { bookingApiService, getBookingErrorMessage } from '../services/booking.api';
import type { PageResponse, PublicBookingTrip, PublicTripsQuery } from '../types/booking.types';

export function usePublicBookingTrips(initialQuery: PublicTripsQuery = {}) {
  const [data, setData] = useState<PageResponse<PublicBookingTrip> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(initialQuery.page || 1);
  const [filters, setFilters] = useState<Omit<PublicTripsQuery, 'page'>>(initialQuery);

  const fetchTrips = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setError(null);
      try {
        const query: PublicTripsQuery = {
          ...filters,
          page,
          pageSize: filters.pageSize || 12,
        };
        const result = await bookingApiService.getPublicTrips(query, signal);
        setData(result);
        return result;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'CanceledError') return;
        const errInfo = getBookingErrorMessage(err, 'Không thể tải danh sách chuyến đi.');
        setError(errInfo.message);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [filters, page]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchTrips(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchTrips]);

  const updateFilters = useCallback((newFilters: Partial<PublicTripsQuery>) => {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  return {
    trips: data?.items || [],
    total: data?.total || 0,
    page: data?.page || page,
    pageSize: data?.pageSize || 12,
    isLoading,
    error,
    setPage,
    setFilters: updateFilters,
    refetch: () => fetchTrips(),
  };
}
