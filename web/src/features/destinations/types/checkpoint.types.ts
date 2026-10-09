import { RecordStatus, PaginationMeta } from './destination.types';

export type CheckpointType = 'START' | 'CAMPSITE' | 'SUMMIT' | 'WATER_SOURCE' | 'VIEWPOINT' | 'END';

export interface CheckpointDestination {
  id: string;
  name: string;
  region?: string | null;
}

export interface Checkpoint {
  id: string;
  destinationId: string;
  code?: string | null;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  defaultRadiusMeters: number;
  checkpointType?: CheckpointType | null;
  status: RecordStatus;
  destination?: CheckpointDestination;
  trailCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedCheckpointResponse {
  items: Checkpoint[];
  pagination: PaginationMeta;
}

export interface GetCheckpointsQuery {
  page?: number;
  pageSize?: number;
  destinationId: string; // Required
  checkpointType?: CheckpointType;
  keyword?: string;
  status?: RecordStatus;
}

export interface CreateCheckpointPayload {
  destinationId: string;
  code?: string | null;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  defaultRadiusMeters?: number;
  checkpointType?: CheckpointType | null;
  status?: RecordStatus;
}

export interface UpdateCheckpointPayload extends Partial<CreateCheckpointPayload> {}
