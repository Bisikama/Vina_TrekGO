import { useCallback, useEffect, useRef, useState } from 'react';

import { getRentalCatalog } from '@/features/rentals/api/get-rental-catalog';
import type { RentalCatalogData } from '@/features/rentals/types/rental-catalog';

type RentalCatalogState = {
  data: RentalCatalogData | null;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
};

export function useRentalCatalog(bookingId: string) {
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<RentalCatalogState>({
    data: null,
    error: null,
    isLoading: true,
    isRefreshing: false,
  });

  const load = useCallback(async (refreshing = false) => {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((current) =>
      refreshing
        ? { ...current, error: null, isRefreshing: true }
        : { data: null, error: null, isLoading: true, isRefreshing: false },
    );

    try {
      const data = await getRentalCatalog(bookingId, controller.signal);
      if (requestId === requestIdRef.current) {
        setState({ data, error: null, isLoading: false, isRefreshing: false });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      if (requestId === requestIdRef.current) {
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error : new Error('Đã xảy ra lỗi không xác định.'),
          isLoading: false,
          isRefreshing: false,
        }));
      }
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return {
    ...state,
    refresh: () => load(true),
    retry: () => load(false),
  };
}
