'use client';

import useSWR from 'swr';
import { bookingApiService, getBookingErrorMessage } from '../services/booking.api';
import type { PublicBookingTrip } from '../types/booking.types';

export function usePublicBookingTripDetail(tripId: string | null | undefined) {
  const { data, error: swrError, isLoading, mutate } = useSWR<PublicBookingTrip>(
    tripId ? ['public-booking-trip-detail', tripId] : null,
    ([, id]: [string, string]) => bookingApiService.getPublicTripDetail(id),
    {
      revalidateOnFocus: true,
      refreshInterval: 15000,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  const error = swrError
    ? getBookingErrorMessage(swrError, 'Không thể tải chi tiết chuyến đi.').message
    : null;

  return {
    trip: data ?? null,
    isLoading: Boolean(tripId) && isLoading && !data,
    error,
    refetch: () => mutate(),
  };
}
