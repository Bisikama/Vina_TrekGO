import { apiClient } from '@/lib/axios';
import {
  Destination,
  PaginatedDestinationResponse,
  GetDestinationsQuery,
  CreateDestinationPayload,
  UpdateDestinationPayload,
} from '../types/destination.types';

const BASE_URL = '/api/v1/destinations';

const sanitizeDestinationQuery = (query?: GetDestinationsQuery) => {
  if (!query) return undefined;
  const clean: Record<string, any> = {};

  if (query.page && query.page > 0) clean.page = query.page;
  if (query.pageSize && query.pageSize > 0) clean.pageSize = query.pageSize;
  if (query.keyword && query.keyword.trim().length > 0) {
    clean.keyword = query.keyword.trim();
  }
  if (query.region && query.region.trim().length > 0) {
    clean.region = query.region.trim();
  }
  if (query.status && ['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(query.status)) {
    clean.status = query.status;
  }

  return clean;
};

export const destinationApi = {
  getDestinations: async (query?: GetDestinationsQuery): Promise<PaginatedDestinationResponse> => {
    const cleanParams = sanitizeDestinationQuery(query);
    const response = await apiClient.get<PaginatedDestinationResponse>(BASE_URL, {
      params: cleanParams,
    });
    return response.data;
  },

  getDestinationDetail: async (id: string): Promise<Destination> => {
    const response = await apiClient.get<Destination>(`${BASE_URL}/${id}`);
    return response.data;
  },

  createDestination: async (payload: CreateDestinationPayload): Promise<Destination> => {
    const response = await apiClient.post<Destination>(BASE_URL, payload);
    return response.data;
  },

  updateDestination: async (id: string, payload: UpdateDestinationPayload): Promise<Destination> => {
    const response = await apiClient.patch<Destination>(`${BASE_URL}/${id}`, payload);
    return response.data;
  },

  deleteDestination: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(`${BASE_URL}/${id}`);
    return response.data;
  },
};
