export type RecordStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PickupPointItem {
  id?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  code?: string | null;
  note?: string | null;
  status?: RecordStatus;
}

export interface Destination {
  id: string;
  name: string;
  description?: string | null;
  region?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  status: RecordStatus;
  trailCount?: number;
  pickupPointCount?: number;
  pickupPoints?: PickupPointItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedDestinationResponse {
  items: Destination[];
  pagination: PaginationMeta;
}

export interface GetDestinationsQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  region?: string;
  status?: RecordStatus;
}

export interface CreateDestinationPayload {
  name: string;
  description?: string | null;
  region?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  status?: RecordStatus;
  pickupPoints?: PickupPointItem[];
}

export interface UpdateDestinationPayload extends Partial<CreateDestinationPayload> {
  pickupPoints?: PickupPointItem[];
}
