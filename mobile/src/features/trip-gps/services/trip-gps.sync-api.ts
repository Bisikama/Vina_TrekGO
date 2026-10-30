import { API_BASE_URL, ApiError, refreshSessionOnce } from '@/lib/api-client';
import { readStoredAuth } from '@/features/auth/storage';
import type { SyncMetadata, SyncBatch, SyncManifest, SyncComplete, SyncStatus } from '../types';

export async function gpsSyncRequest<T>(tripId: string, sessionId: string, deviceId: string, accountId: string,
  endpoint: string, payload?: unknown): Promise<T> {
  // Never let automatic token refresh replay account A's outbox with account B's token.
  const auth = await readStoredAuth();
  if (!auth || auth.user.id !== accountId) throw new ApiError('Tài khoản GPS đã thay đổi.', 401, 'GPS_ACCOUNT_CHANGED');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const send = (token: string) => fetch(`${API_BASE_URL}/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/sessions/${encodeURIComponent(sessionId)}/sync/${endpoint}`, {
      method: payload === undefined ? 'GET' : 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-GPS-Device-Id': deviceId, Authorization: `Bearer ${token}` },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
    let response = await send(auth.accessToken);
    if (response.status === 401) {
      const current = await readStoredAuth();
      if (current?.user.id !== accountId) throw new ApiError('Tài khoản GPS đã thay đổi.', 401, 'GPS_ACCOUNT_CHANGED');
      const renewed = current.accessToken !== auth.accessToken ? current : await refreshSessionOnce();
      if (renewed.user.id !== accountId || (await readStoredAuth())?.user.id !== accountId) throw new ApiError('Tài khoản GPS đã thay đổi.', 401, 'GPS_ACCOUNT_CHANGED');
      response = await send(renewed.accessToken);
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const retryHeader = response.headers.get('Retry-After');
      const retryAfterSeconds = retryHeader ? Math.max(0, Number(retryHeader) || (Date.parse(retryHeader) - Date.now()) / 1000) : undefined;
      throw new ApiError(body.error?.message ?? 'Không đồng bộ được GPS.', response.status, body.error?.code,
        { ...body.error?.details, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) }, body.error?.retryable);
    }
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Mất kết nối khi đồng bộ GPS. Dữ liệu vẫn được giữ trên máy.', 0);
  } finally { clearTimeout(timeout); }
}
export interface MetadataAck { metadataRevision: number; acknowledgedCommandIds: string[]; uploadDeadline: string | null; recordingStatus: 'ACTIVE' | 'PAUSED' | 'STOPPED'; effectiveEndedAt: string | null }
export interface BatchAck { batchId: string; snapshotRevision: number; acceptedSampleIds: string[]; duplicateSampleIds: string[]; rejectedSamples: { clientSampleId: string; code: string }[] }
export type SyncPayload = SyncMetadata | SyncBatch | SyncManifest | SyncComplete;
export type { SyncStatus };
