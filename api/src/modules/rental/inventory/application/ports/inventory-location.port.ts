export const INVENTORY_LOCATION_PORT = Symbol('INVENTORY_LOCATION_PORT');

export interface InventoryLocationView {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
}

export interface ListInventoryLocationsParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}

export interface CreateInventoryLocationParams {
  code: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateInventoryLocationParams {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface InventoryLocationPort {
  listLocations(params: ListInventoryLocationsParams): Promise<{ items: InventoryLocationView[]; total: number }>;
  getLocationById(id: string): Promise<InventoryLocationView | null>;
  getLocationByCode(code: string): Promise<InventoryLocationView | null>;
  createLocation(params: CreateInventoryLocationParams): Promise<InventoryLocationView>;
  updateLocation(id: string, params: UpdateInventoryLocationParams): Promise<InventoryLocationView>;
}
