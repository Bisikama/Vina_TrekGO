import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { getTrekkerHome } from '@/features/home/services/trekker-home.mock';

import type { TrekkerHomeData } from '@/features/home/types/trekker-home';

type HomeState = {
  data: TrekkerHomeData | null;
  error: Error | null;
  isLoading: boolean;
  isRefreshing: boolean;
};

export function useTrekkerHome() {
  const abortRef =
    useRef<AbortController | null>(
      null,
    );

  const [state, setState] =
    useState<HomeState>({
      data: null,
      error: null,
      isLoading: true,
      isRefreshing: false,
    });

  const load = useCallback(
    async (refreshing = false) => {
      abortRef.current?.abort();

      const controller =
        new AbortController();

      abortRef.current = controller;

      setState((current) => ({
        ...current,
        error: null,
        isLoading: refreshing
          ? current.isLoading
          : true,
        isRefreshing: refreshing,
      }));

      try {
        const data =
          await getTrekkerHome(
            controller.signal,
          );

        setState({
          data,
          error: null,
          isLoading: false,
          isRefreshing: false,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === 'AbortError'
        ) {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error
              : new Error(
                  'Không thể tải trang chủ.',
                ),
          isLoading: false,
          isRefreshing: false,
        }));
      }
    },
    [],
  );

  useEffect(() => {
    void load();

    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  return {
    ...state,
    refresh: () => load(true),
    retry: () => load(false),
  };
}