import { RecordStatus, PaginationMeta } from './destination.types';

export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD' | 'EXTREME';

export interface TrailCheckpointInput {
  checkpointId: string;
  sequence: number;
  isRequired?: boolean;
}

export interface TrailCheckpointResponse {
  id: string;
  name: string;
  code?: string | null;
  sequence: number;
  isRequired: boolean;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface SystemTrailSummary {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  difficulty: DifficultyLevel;
  distanceKm: number;
  elevationGainM?: number | null;
  estimatedDurationMinutes?: number | null;
  price: number;
  status: RecordStatus;
  destination: {
    id: string;
    name: string;
    region?: string | null;
    centerLat?: number | null;
    centerLng?: number | null;
  };
  checkpointCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SystemTrailDetail extends SystemTrailSummary {
  version: number;
  routeGeojson: any;
  checkpoints: TrailCheckpointResponse[];
  bounds?: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  } | null;
}

export interface PaginatedSystemTrailResponse {
  items: SystemTrailSummary[];
  pagination: PaginationMeta;
}

export interface GetSystemTrailsQuery {
  page?: number;
  pageSize?: number;
  destinationId?: string;
  keyword?: string;
  difficulty?: DifficultyLevel;
  status?: RecordStatus;
  minDistance?: number;
  maxDistance?: number;
}

export interface CreateSystemTrailPayload {
  destinationId: string;
  code: string;
  name: string;
  description?: string | null;
  difficulty: DifficultyLevel;
  distanceKm: number;
  elevationGainM?: number | null;
  estimatedDurationMinutes?: number | null;
  price?: number;
  routeGeojson: any;
  checkpoints?: TrailCheckpointInput[];
  status?: RecordStatus;
}

export interface UpdateSystemTrailPayload extends Partial<CreateSystemTrailPayload> {}
