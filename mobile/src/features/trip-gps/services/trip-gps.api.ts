import { apiRequest } from '@/lib/api-client';
import type {
  ActualRouteResponse,
  FinishSessionRequest,
  FinishSessionResponse,
  GpsContextResponse,
  GpsStateResponse,
  LiveRouteResponse,
  SamplesRequest,
  SamplesResponse,
  SessionControlRequest,
  SessionResponse,
  StartSessionRequest,
} from '../types';

/**
 * 10 REST Operations according to docs/GPS_IN_TRIP.md (Section 11)
 * Base URL: /api/v1 (relative to API_BASE_URL)
 */

/** GET /geo/trips/:tripId/gps/context */
export async function endGpsTrip(tripId: string): Promise<{ tripId: string; tripStatus: 'COMPLETED'; completedAt: string }> {
  return apiRequest(`/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/end-trip`, { method: 'POST' });
}

export async function getGpsContext(tripId: string): Promise<GpsContextResponse> {
  return apiRequest<GpsContextResponse>(`/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/context`, { headers: { 'X-GPS-Protocol': 'trip-gps-sync/2' } });
}

/** GET /geo/trips/:tripId/gps/state */
export async function getGpsState(tripId: string): Promise<GpsStateResponse> {
  return apiRequest<GpsStateResponse>(`/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/state`, { headers: { 'X-GPS-Protocol': 'trip-gps-sync/2' } });
}

/** POST /geo/trips/:tripId/gps/sessions */
export async function startGpsSession(
  tripId: string,
  payload: StartSessionRequest,
  deviceId: string
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>(`/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GPS-Device-Id': deviceId,
    },
    body: JSON.stringify(payload),
  });
}

/** GET /geo/trips/:tripId/gps/sessions/:sessionId */
export async function getGpsSession(
  tripId: string,
  sessionId: string,
  deviceId: string
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>(
    `/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'GET',
      headers: {
        'X-GPS-Device-Id': deviceId,
      },
    }
  );
}

/** POST /geo/trips/:tripId/gps/sessions/:sessionId/samples */
export async function uploadGpsSamples(
  tripId: string,
  sessionId: string,
  payload: SamplesRequest,
  deviceId: string
): Promise<SamplesResponse> {
  return apiRequest<SamplesResponse>(
    `/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/sessions/${encodeURIComponent(sessionId)}/samples`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GPS-Device-Id': deviceId,
      },
      body: JSON.stringify(payload),
    }
  );
}

/** POST /geo/trips/:tripId/gps/sessions/:sessionId/pause */
export async function pauseGpsSession(
  tripId: string,
  sessionId: string,
  payload: SessionControlRequest,
  deviceId: string
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>(
    `/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/sessions/${encodeURIComponent(sessionId)}/pause`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GPS-Device-Id': deviceId,
      },
      body: JSON.stringify(payload),
    }
  );
}

/** POST /geo/trips/:tripId/gps/sessions/:sessionId/resume */
export async function resumeGpsSession(
  tripId: string,
  sessionId: string,
  payload: SessionControlRequest,
  deviceId: string
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>(
    `/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/sessions/${encodeURIComponent(sessionId)}/resume`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GPS-Device-Id': deviceId,
      },
      body: JSON.stringify(payload),
    }
  );
}

/** POST /geo/trips/:tripId/gps/sessions/:sessionId/finish */
export async function finishGpsSession(
  tripId: string,
  sessionId: string,
  payload: FinishSessionRequest,
  deviceId: string
): Promise<FinishSessionResponse> {
  return apiRequest<FinishSessionResponse>(
    `/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/sessions/${encodeURIComponent(sessionId)}/finish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GPS-Device-Id': deviceId,
      },
      body: JSON.stringify(payload),
    }
  );
}

/** GET /geo/trips/:tripId/gps/my-route */
export async function getMyLiveRoute(tripId: string): Promise<LiveRouteResponse> {
  return apiRequest<LiveRouteResponse>(`/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/my-route`);
}

/** GET /geo/trips/:tripId/gps/actual-routes/me */
export async function getMyActualRoute(tripId: string): Promise<ActualRouteResponse> {
  return apiRequest<ActualRouteResponse>(`/api/v1/geo/trips/${encodeURIComponent(tripId)}/gps/actual-routes/me`);
}
