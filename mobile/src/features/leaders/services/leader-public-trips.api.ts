import { apiRequest } from "@/lib/api-client";

// ─── Leader Public Trip Types ─────────────────────────────────────────────────

export interface TripOptionDestination {
  id: string;
  name: string;
}

export interface TripOptionPickupPoint {
  id: string;
  name: string;
}

export interface TripOptionCheckpoint {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
}

export interface ScheduleConflictResponse {
  hasConflict: boolean;
  conflicts: Array<{
    id: string;
    title: string;
    startAt: string;
    endAt: string;
  }>;
}

export interface LeaderTrailSuggestion {
  id: string;
  name: string;
  difficulty?: string;
  distanceKm?: string | number;
  lengthKm?: string | number;
  elevationGainM?: number;
  canAppend?: boolean;
  checkpointIds?: string[];
  coveredCheckpointIds?: string[];
  routeGeojson?: any;
  destination?: {
    id?: string;
    name?: string;
    centerLat?: number;
    centerLng?: number;
  };
}

export interface SystemTrailDetail {
  id: string;
  code: string;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  destination: {
    name: string;
    centerLat: number;
    centerLng: number;
  };
  routeGeojson: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      geometry: {
        type: "LineString";
        coordinates: number[][];
      };
    }>;
  };
  checkpoints: Array<{
    id: string;
    name: string;
    sequence: number;
    latitude: number;
    longitude: number;
  }>;
  initialCamera: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  };
}

export type LeaderTripStatus =
  | "DRAFT"
  | "OPEN"
  | "FULL"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "CANCEL_PENDING"
  | "CANCELLED";

export interface LeaderCheckpointDetail {
  id?: string;
  sourceCheckpointId?: string;
  name: string;
  description?: string | null;
  latitude: number | string;
  longitude: number | string;
  radiusMeters?: number;
  sequence?: number;
  isRequired?: boolean;
  isEnabled?: boolean;
}

export interface LeaderTrailDetail {
  id?: string;
  systemTrailId?: string;
  sequence?: number;
  snapshotName?: string;
  name?: string;
  snapshotDifficulty?: string;
  difficulty?: string;
  snapshotDistanceKm?: number | string;
  distanceKm?: number | string;
  snapshotElevationGainM?: number;
  elevationGainM?: number;
  snapshotGeojson?: any;
  sourceTrailVersion?: number;
  snapshotCheckpointIds?: string[];
}

export interface LeaderPublicTrip {
  id: string;
  title: string;
  description?: string;
  status: LeaderTripStatus;
  startAt: string;
  endAt: string;
  capacity: number;
  remainingSlots?: number;
  pricePerPax?: string;
  price?: string;
  currency?: string;
  version: number;
  publishedAt?: string;
  destinationId?: string;
  destination?: { id: string; name: string };
  pickupPointId?: string;
  pickupPoint?: { id: string; name: string; address?: string | null };
  priceExplanation?: string | null;
  minPax?: number;
  tripType?: "PUBLIC" | string;
  creatorId?: string;
  leaderId?: string;
  checkpoints?: LeaderCheckpointDetail[];
  trails?: LeaderTrailDetail[];
  registrationOpenAt?: string | null;
  registrationDeadlineAt?: string | null;
}

export interface TripDiscoverySlots {
  id: string;
  capacity: number;
  remainingSlots: number;
  destination?: { id: string; name: string };
  pickup?: { id: string; name: string; address?: string | null };
  leader?: { id: string; fullName: string };
}

export interface CreatePublicTripInput {
  destinationId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  pickupPointId: string;
  capacity: number;
  minPax?: number;
  price: string;
  priceExplanation?: string | null;
  registrationOpenAt?: string | null;
  registrationDeadlineAt?: string | null;
}

export interface UpdatePublicTripInput {
  expectedVersion: number;
  priceExplanation?: string | null;
  title?: string;
  description?: string | null;
  startAt?: string;
  endAt?: string;
  pickupPointId?: string;
  capacity?: number;
  minPax?: number;
  price?: string;
  destinationId?: string;
  registrationOpenAt?: string | null;
  registrationDeadlineAt?: string | null;
}

export interface SetCheckpointsInput {
  expectedVersion: number;
  checkpointIds: string[];
}

export interface SetTrailsInput {
  expectedVersion: number;
  trailIds: string[];
}

export interface PublishTripInput {
  expectedVersion: number;
}

export interface RequestCancellationInput {
  expectedVersion: number;
  reason: string;
  evidenceUrls?: string[];
}

export interface ReadinessIssue {
  code?: string;
  message?: string;
  reason?: string;
  field?: string;
  details?: unknown;
}

export interface ReadinessCheckResponse {
  canPublish: boolean;
  issues: Array<string | ReadinessIssue>;
  version: number;
}

export interface LeaderTripsListResponse {
  items: LeaderPublicTrip[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Response Unwrap Helper ──────────────────────────────────────────────────

function unwrapLeader<T>(res: any): T {
  if (res && typeof res === "object" && "data" in res && res.data !== null && res.data !== undefined) {
    return res.data as T;
  }
  return res as T;
}

// ─── [NHÓM A] Data Fetching for Leader ───────────────────────────────────────

/** GET /api/v1/leader/trip-options/destinations?page=1&pageSize=20 */
export async function getDestinations(
  accessToken: string,
  page = 1,
  pageSize = 20,
): Promise<TripOptionDestination[]> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/trip-options/destinations?page=${page}&pageSize=${pageSize}`,
    { accessToken },
  );
  const data = unwrapLeader<any>(raw);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/v1/leader/trip-options/pickup-points?destinationId={id}&page=1&pageSize=20 */
export async function getPickupPoints(
  destinationId: string,
  accessToken: string,
  page = 1,
  pageSize = 20,
): Promise<TripOptionPickupPoint[]> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/trip-options/pickup-points?destinationId=${destinationId}&page=${page}&pageSize=${pageSize}`,
    { accessToken },
  );
  const data = unwrapLeader<any>(raw);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/v1/leader/trip-options/checkpoints?destinationId={id}&page=1&pageSize=20 */
export async function getCheckpointOptions(
  destinationId: string,
  accessToken: string,
  page = 1,
  pageSize = 20,
): Promise<TripOptionCheckpoint[]> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/trip-options/checkpoints?destinationId=${destinationId}&page=${page}&pageSize=${pageSize}`,
    { accessToken },
  );
  const data = unwrapLeader<any>(raw);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/v1/leaders/me/schedule-conflicts?startAt={ISO}&endAt={ISO}&excludeTripId={tripId} */
export async function checkScheduleConflict(
  startAt: string,
  endAt: string,
  accessToken: string,
  excludeTripId?: string,
): Promise<ScheduleConflictResponse> {
  let url = `/api/v1/leaders/me/schedule-conflicts?startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`;
  if (excludeTripId) {
    url += `&excludeTripId=${encodeURIComponent(excludeTripId)}`;
  }
  const raw = await apiRequest<any>(url, { accessToken });
  return unwrapLeader<ScheduleConflictResponse>(raw);
}

// ─── [NHÓM B] Leader Create & Publish Flow ───────────────────────────────────

/** POST /api/v1/leader/public-trips — Create DRAFT trip */
export async function createPublicTrip(
  input: CreatePublicTripInput,
  accessToken: string,
): Promise<LeaderPublicTrip> {
  const raw = await apiRequest<any>("/api/v1/leader/public-trips", {
    method: "POST",
    accessToken,
    body: JSON.stringify(input),
  });
  return unwrapLeader<LeaderPublicTrip>(raw);
}

/** PATCH /api/v1/leader/public-trips/:id — Update DRAFT trip */
export async function updatePublicTrip(
  tripId: string,
  input: UpdatePublicTripInput,
  accessToken: string,
): Promise<LeaderPublicTrip> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}`,
    {
      method: "PATCH",
      accessToken,
      body: JSON.stringify(input),
    },
  );
  return unwrapLeader<LeaderPublicTrip>(raw);
}

/** GET /api/v1/leader/public-trips/:id — Get trip detail for leader */
export async function getLeaderPublicTripById(
  tripId: string,
  accessToken: string,
): Promise<LeaderPublicTrip> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}`,
    { accessToken },
  );
  return unwrapLeader<LeaderPublicTrip>(raw);
}

/** PUT /api/v1/leader/public-trips/:id/checkpoints */
export async function setTripCheckpoints(
  tripId: string,
  input: SetCheckpointsInput,
  accessToken: string,
): Promise<LeaderPublicTrip> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/checkpoints`,
    {
      method: "PUT",
      accessToken,
      body: JSON.stringify(input),
    },
  );
  return unwrapLeader<LeaderPublicTrip>(raw);
}

/** GET /api/v1/leader/public-trips/:id/trail-suggestions */
export async function getTrailSuggestions(
  tripId: string,
  accessToken: string,
  page = 1,
  pageSize = 20,
): Promise<LeaderTrailSuggestion[]> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/trail-suggestions?page=${page}&pageSize=${pageSize}`,
    { accessToken },
  );
  const data = unwrapLeader<any>(raw);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** PUT /api/v1/leader/public-trips/:id/trails */
export async function setTripTrails(
  tripId: string,
  input: SetTrailsInput,
  accessToken: string,
): Promise<LeaderPublicTrip> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/trails`,
    {
      method: "PUT",
      accessToken,
      body: JSON.stringify(input),
    },
  );
  return unwrapLeader<LeaderPublicTrip>(raw);
}

/** GET /api/v1/leader/public-trips/:id/readiness */
export async function getTripReadiness(
  tripId: string,
  accessToken: string,
): Promise<ReadinessCheckResponse> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/readiness`,
    { accessToken },
  );
  return unwrapLeader<ReadinessCheckResponse>(raw);
}

/** POST /api/v1/leader/public-trips/:id/publish */
export async function publishTrip(
  tripId: string,
  input: PublishTripInput,
  accessToken: string,
): Promise<LeaderPublicTrip> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/publish`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify(input),
    },
  );
  return unwrapLeader<LeaderPublicTrip>(raw);
}

/** POST /api/v1/leader/public-trips/:id/cancellation-requests */
export async function requestTripCancellation(
  tripId: string,
  input: RequestCancellationInput,
  accessToken: string,
): Promise<LeaderPublicTrip> {
  const raw = await apiRequest<any>(
    `/api/v1/leader/public-trips/${tripId}/cancellation-requests`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify(input),
    },
  );
  return unwrapLeader<LeaderPublicTrip>(raw);
}

/** GET /api/v1/leader/public-trips?page=1&pageSize=20&destinationId=... */
export async function getLeaderTrips(
  accessToken: string,
  page = 1,
  pageSize = 20,
  destinationId?: string,
): Promise<LeaderTripsListResponse> {
  let url = `/api/v1/leader/public-trips?page=${page}&pageSize=${pageSize}`;
  if (destinationId) {
    url += `&destinationId=${encodeURIComponent(destinationId)}`;
  }
  const raw = await apiRequest<any>(url, { accessToken });
  const res = unwrapLeader<any>(raw);

  // BE trả về trực tiếp mảng LeaderPublicTrip[] hoặc object { items, total, page, pageSize }
  if (Array.isArray(res)) {
    return {
      items: res,
      total: res.length,
      page,
      pageSize,
    };
  }

  return {
    items: Array.isArray(res?.items) ? res.items : [],
    total: typeof res?.total === "number" ? res.total : (res?.items?.length ?? 0),
    page: res?.page || page,
    pageSize: res?.pageSize || pageSize,
  };
}

/** GET /api/v1/system-trails/:trailCode */
export async function getSystemTrailDetail(
  trailCode: string,
): Promise<SystemTrailDetail> {
  return apiRequest<SystemTrailDetail>(`/api/v1/system-trails/${trailCode}`);
}

/** GET /api/v1/leader/trip-options/system-trails/:id */
export async function getSystemTrailById(
  trailId: string,
  accessToken: string,
): Promise<SystemTrailDetail> {
  return apiRequest<SystemTrailDetail>(
    `/api/v1/leader/trip-options/system-trails/${trailId}`,
    { accessToken },
  );
}

/** GET /api/v1/trips/:id — Booking discovery slots info */
export async function getTripDiscoverySlots(
  tripId: string,
): Promise<TripDiscoverySlots | null> {
  try {
    return await apiRequest<TripDiscoverySlots>(`/api/v1/trips/${tripId}`);
  } catch {
    return null;
  }
}
