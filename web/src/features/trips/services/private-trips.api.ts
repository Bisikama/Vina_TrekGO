import { apiClient } from '@/lib/axios';

export interface PrivatePoint { id: string; name: string; sequence: number }
export interface PrivateSource { id: string; type: 'PERSONAL' | 'SYSTEM'; name: string; destinationId: string | null; points: PrivatePoint[] }
export interface PrivateTrip { id: string; title: string; description: string | null; startAt: string; endAt: string; maxPax: number; pickupPointId: string; destinationId: string; status: string; version: number }
export interface PrivateInput { title: string; description?: string; startAt: string; endAt: string; capacity: number; pickupPointId: string }
const base = '/api/v1/private-trips';
async function all<T>(url: string, params: Record<string, string> = {}): Promise<T[]> {
  const result: T[] = [];
  for (let page = 1; ; page++) {
    const { data } = await apiClient.get<T[]>(url, { params: { ...params, page } });
    result.push(...data); if (data.length < 20) return result;
  }
}
export const privateTripsApi = {
  async sources(): Promise<PrivateSource[]> {
    const [personal, access] = await Promise.all([
      all<{ id: string; title: string; destinationId: string | null; personalCheckpointsViaPersonalTrailId: PrivatePoint[] }>('/api/v1/me/personal-trails'),
      all<{ systemTrail: { id: string; name: string; destinationId: string; trailCheckpointsViaSystemTrailId: { sequence: number; checkpoint: { id: string; name: string; status: string } }[] } }>('/api/v1/me/trail-accesses'),
    ]);
    return [...personal.map(p => ({ id: p.id, type: 'PERSONAL' as const, name: p.title, destinationId: p.destinationId, points: p.personalCheckpointsViaPersonalTrailId })), ...access.map(({ systemTrail: t }) => ({ id: t.id, type: 'SYSTEM' as const, name: t.name, destinationId: t.destinationId, points: t.trailCheckpointsViaSystemTrailId.filter(p => p.checkpoint.status === 'ACTIVE').map(p => ({ id: p.checkpoint.id, name: p.checkpoint.name, sequence: p.sequence })) }))];
  },
  list: async () => all<PrivateTrip>(base),
  pickups: async (destinationId: string) => all<{ id: string; name: string }>('/api/v1/private-trip-options/pickup-points', { destinationId }),
  create: async (input: PrivateInput & { type: 'PERSONAL' | 'SYSTEM'; trailRef: string; destinationId: string; checkpointIds: string[] }) => (await apiClient.post<PrivateTrip>(base, input)).data,
  update: async (trip: PrivateTrip, input: PrivateInput) => (await apiClient.patch<PrivateTrip>(`${base}/${trip.id}`, { ...input, expectedVersion: trip.version })).data,
  cancel: async (trip: PrivateTrip, reason: string) => (await apiClient.post<PrivateTrip>(`${base}/${trip.id}/cancel`, { expectedVersion: trip.version, reason })).data,
  invite: async (trip: PrivateTrip, expiresAt?: string) => (await apiClient.post<{ inviteCode: string; expiresAt: string; tripVersion: number }>(`${base}/${trip.id}/invitations`, { expectedVersion: trip.version, expiresAt })).data,
  revoke: async (trip: PrivateTrip) => (await apiClient.post<PrivateTrip>(`${base}/${trip.id}/invitations/revoke`, { expectedVersion: trip.version })).data,
};
