import { apiClient } from '@/lib/axios';
import {
  SystemTrailDetail,
  PaginatedSystemTrailResponse,
  GetSystemTrailsQuery,
  CreateSystemTrailPayload,
  UpdateSystemTrailPayload,
} from '../types/system-trail.types';

const BASE_URL = '/api/v1/system-trails';
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const sanitizeTrailQuery = (query?: GetSystemTrailsQuery) => {
  if (!query) return undefined;
  const clean: Record<string, any> = {};

  if (query.page && query.page > 0) clean.page = query.page;
  if (query.pageSize && query.pageSize > 0) clean.pageSize = query.pageSize;
  if (query.destinationId && UUID_REGEX.test(query.destinationId)) {
    clean.destinationId = query.destinationId;
  }
  if (query.keyword && query.keyword.trim().length > 0) {
    clean.keyword = query.keyword.trim();
  }
  if (query.difficulty && ['EASY', 'MEDIUM', 'HARD', 'EXTREME'].includes(query.difficulty)) {
    clean.difficulty = query.difficulty;
  }
  if (query.status && ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(query.status)) {
    clean.status = query.status;
  }
  if (typeof query.minDistance === 'number' && query.minDistance >= 0) {
    clean.minDistance = query.minDistance;
  }
  if (typeof query.maxDistance === 'number' && query.maxDistance >= 0) {
    clean.maxDistance = query.maxDistance;
  }

  return clean;
};

export const systemTrailApi = {
  getTrails: async (query?: GetSystemTrailsQuery): Promise<PaginatedSystemTrailResponse> => {
    const cleanParams = sanitizeTrailQuery(query);
    const response = await apiClient.get<PaginatedSystemTrailResponse>(BASE_URL, {
      params: cleanParams,
    });
    return response.data;
  },

  getTrailDetail: async (idOrCode: string): Promise<SystemTrailDetail> => {
    const response = await apiClient.get<SystemTrailDetail>(`${BASE_URL}/${idOrCode}`);
    return response.data;
  },

  createTrail: async (payload: CreateSystemTrailPayload): Promise<SystemTrailDetail> => {
    const response = await apiClient.post<SystemTrailDetail>(BASE_URL, payload);
    return response.data;
  },

  updateTrail: async (id: string, payload: UpdateSystemTrailPayload): Promise<SystemTrailDetail> => {
    const response = await apiClient.patch<SystemTrailDetail>(`${BASE_URL}/${id}`, payload);
    return response.data;
  },

  deleteTrail: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(`${BASE_URL}/${id}`);
    return response.data;
  },
};
