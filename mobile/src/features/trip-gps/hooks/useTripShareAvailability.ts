import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getMyActualRoute } from '../services/trip-gps.api';
import type { ActualRouteResponse } from '../types';

export type TripShareState = 'hidden' | 'processing' | 'ready';

const POLL_MS = 10000;

function toShareState(route: ActualRouteResponse, expectRoute: boolean): TripShareState {
  if (route.resultStatus === 'READY') return route.pointCount >= 2 ? 'ready' : 'hidden';
  if (route.resultStatus === 'PROCESSING') return 'processing';
  // Right after finishing, the server may not have seen the stop command yet.
  if (expectRoute && (route.resultStatus === 'RECORDING' || route.resultStatus === 'NOT_STARTED')) return 'processing';
  return 'hidden';
}

export function useTripShareAvailability(tripId: string | undefined, expectRoute = false): TripShareState {
  const [state, setState] = useState<TripShareState>(expectRoute ? 'processing' : 'hidden');

  const check = useCallback(async (isCurrent: () => boolean) => {
    if (!tripId) return;
    try {
      const route = await getMyActualRoute(tripId);
      if (isCurrent()) setState(toShareState(route, expectRoute));
    } catch {
      if (isCurrent()) setState(previous => (expectRoute ? previous : 'hidden'));
    }
  }, [tripId, expectRoute]);

  useFocusEffect(useCallback(() => {
    let current = true;
    void check(() => current);
    return () => { current = false; };
  }, [check]));

  useEffect(() => {
    if (state !== 'processing') return;
    let current = true;
    const timer = setInterval(() => void check(() => current), POLL_MS);
    return () => { current = false; clearInterval(timer); };
  }, [state, check]);

  return state;
}
