import { apiClient } from '@/lib/axios';
import { useAuthStore } from '@/features/auth';
import type { Option, Readiness, Trail, Trip, TripInput } from '../types/trip.types';

const config = () => ({ headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` } });
const base = '/api/v1/leader/public-trips';
export const tripsApi = {
  list: async (page = 1) => (await apiClient.get<Trip[]>(base, { ...config(), params: { page, pageSize: 20 } })).data,
  detail: async (id: string) => (await apiClient.get<Trip>(`${base}/${id}`, config())).data,
  create: async (input: TripInput) => (await apiClient.post<Trip>(base, input, config())).data,
  update: async (id: string, expectedVersion: number, input: TripInput) => (await apiClient.patch<Trip>(`${base}/${id}`, { ...input, expectedVersion }, config())).data,
  checkpoints: async (trip: Trip, checkpointIds: string[]) => (await apiClient.put<Trip>(`${base}/${trip.id}/checkpoints`, { expectedVersion: trip.version, checkpointIds }, config())).data,
  trails: async (trip: Trip, trailIds: string[]) => (await apiClient.put<Trip>(`${base}/${trip.id}/trails`, { expectedVersion: trip.version, trailIds }, config())).data,
  readiness: async (id: string) => (await apiClient.get<Readiness>(`${base}/${id}/readiness`, config())).data,
  publish: async (trip: Trip) => (await apiClient.post<Trip>(`${base}/${trip.id}/publish`, { expectedVersion: trip.version }, config())).data,
  cancel: async (trip: Trip, reason: string) => (await apiClient.post<Trip>(`${base}/${trip.id}/cancellation-requests`, { expectedVersion: trip.version, reason, evidenceUrls: [] }, config())).data,
  suggestions: async (id: string, page: number) => (await apiClient.get<Trail[]>(`${base}/${id}/trail-suggestions`, { ...config(), params: { page, pageSize: 20 } })).data,
  options: async (kind: 'destinations' | 'pickup-points' | 'checkpoints', destinationId?: string, page = 1) => (await apiClient.get<Option[]>(`/api/v1/leader/trip-options/${kind}`, { ...config(), params: { destinationId, page, pageSize: 100 } })).data,
};
