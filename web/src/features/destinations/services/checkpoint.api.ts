import { apiClient } from '@/lib/axios';
import {
  Checkpoint,
  PaginatedCheckpointResponse,
  GetCheckpointsQuery,
  CreateCheckpointPayload,
  UpdateCheckpointPayload,
} from '../types/checkpoint.types';

const BASE_URL = '/api/v1/checkpoints';
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const sanitizeCheckpointQuery = (query: GetCheckpointsQuery) => {
  const clean: Record<string, any> = {
    destinationId: query.destinationId,
  };

  if (query.page && query.page > 0) clean.page = query.page;
  if (query.pageSize && query.pageSize > 0) clean.pageSize = query.pageSize;
  if (query.keyword && query.keyword.trim().length > 0) {
    clean.keyword = query.keyword.trim();
  }
  if (query.checkpointType && query.checkpointType.trim().length > 0) {
    clean.checkpointType = query.checkpointType;
  }
  if (query.status && ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(query.status)) {
    clean.status = query.status;
  }

  return clean;
};

export const checkpointApi = {
  getCheckpoints: async (query: GetCheckpointsQuery): Promise<PaginatedCheckpointResponse> => {
    if (!query.destinationId || !UUID_REGEX.test(query.destinationId)) {
      return {
        items: [],
        pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
      };
    }
    const cleanParams = sanitizeCheckpointQuery(query);
    const response = await apiClient.get<PaginatedCheckpointResponse>(BASE_URL, {
      params: cleanParams,
    });
    return response.data;
  },

  getCheckpointDetail: async (id: string): Promise<Checkpoint> => {
    const response = await apiClient.get<Checkpoint>(`${BASE_URL}/${id}`);
    return response.data;
  },

  createCheckpoint: async (payload: CreateCheckpointPayload): Promise<Checkpoint> => {
    const response = await apiClient.post<Checkpoint>(BASE_URL, payload);
    return response.data;
  },

  updateCheckpoint: async (id: string, payload: UpdateCheckpointPayload): Promise<Checkpoint> => {
    const response = await apiClient.patch<Checkpoint>(`${BASE_URL}/${id}`, payload);
    return response.data;
  },

  deleteCheckpoint: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(`${BASE_URL}/${id}`);
    return response.data;
  },
};
