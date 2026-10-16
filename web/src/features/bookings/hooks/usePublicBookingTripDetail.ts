'use client';

import { useCallback, useEffect, useState } from 'react';
import { bookingApiService, getBookingErrorMessage } from '../services/booking.api';
import type { PublicBookingTrip } from '../types/booking.types';

export function usePublicBookingTripDetail(tripId: string | null | undefined) {
  const [trip, setTrip] = useState<PublicBookingTrip | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(tripId));
  const [error, setError] = useState<string | null>(null);

  const fetchTripDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!tripId) {
        setTrip(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const result = await bookingApiService.getPublicTripDetail(tripId, signal);
        setTrip(result);
        return result;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'CanceledError') return;
        const errInfo = getBookingErrorMessage(err, 'Không thể tải chi tiết chuyến đi.');
        setError(errInfo.message);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [tripId]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchTripDetail(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchTripDetail]);

  return {
    trip,
    isLoading,
    error,
    refetch: () => fetchTripDetail(),
  };
}
