import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { useAuth } from '@/features/auth/AuthContext';
import { tripGpsRuntime } from './services/trip-gps.runtime';

export function TripGpsLifecycle() {
  const { user, accessToken, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading) void tripGpsRuntime.authenticate(user?.id ?? null, accessToken).catch(error => console.warn('[TripGps lifecycle]', error));
  }, [user?.id, accessToken, isLoading]);
  useEffect(() => {
    let online: boolean | undefined;
    void Network.getNetworkStateAsync().then(state => { online = state.isConnected !== false && state.isInternetReachable !== false; }).catch(() => {});
    const network = Network.addNetworkStateListener(state => {
      const next = state.isConnected !== false && state.isInternetReachable !== false;
      if (next && online === false) void tripGpsRuntime.reconnect().catch(error => console.warn('[TripGps reconnect]', error));
      online = next;
    });
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') void tripGpsRuntime.reconnect().catch(error => console.warn('[TripGps foreground]', error));
    });
    return () => { network.remove(); app.remove(); void tripGpsRuntime.authenticate(null, null).catch(error => console.warn('[TripGps stop]', error)); };
  }, []);
  return null;
}
