import axios from "axios";

import { apiClient } from "@/lib/axios";
import type {
  BatchCreateEquipmentUnitsInput,
  ChangeEquipmentMaintenanceInput,
  CreateEquipmentUnitInput,
  EquipmentLabel,
  EquipmentUnit,
  EquipmentUnitCounts,
  EquipmentUnitDetail,
  InventoryLocation,
  ListEquipmentUnitsOptions,
  RentalPagination,
  RentalProduct,
  StaffRentalProductStatus,
  UpdateEquipmentUnitInput,
} from "@/features/rentals/types/rental";

type ApiEnvelope<T> = {
  data: T;
};

type ApiPaginatedResult<T> = {
  items: T[];
  pagination: RentalPagination;
};

type ApiRentalProduct = Omit<
  RentalProduct,
  "description" | "imageUrls" | "spec" | "depositPolicy"
> & {
  description?: string | null;
  depositPolicy?: {
    type?: string;
    amount?: number | string | null;
    referenceValue?: number | string | null;
    percentage?: number | string | null;
  };
  imageUrls?: string[];
  spec?: Record<string, unknown> | null;
};

const PRODUCT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapApiData<T>(payload: unknown): T {
  if (isRecord(payload) && "data" in payload && payload.data !== undefined) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

function toNumber(
  value: number | string | null | undefined,
  fallback = 0,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapStaffProduct(product: ApiRentalProduct): RentalProduct {
  const imageMediaIds = product.imageMediaIds ?? [];
  const directUrls = imageMediaIds.filter(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
  );

  return {
    ...product,
    description: product.description ?? "",
    dailyPrice: toNumber(product.dailyPrice),
    replacementValue:
      product.replacementValue === undefined
        ? undefined
        : toNumber(product.replacementValue),
    depositPolicy: {
      type: product.depositPolicy?.type ?? "FIXED",
      amount: toNumber(product.depositPolicy?.amount),
      referenceValue:
        product.depositPolicy?.referenceValue == null
          ? null
          : toNumber(product.depositPolicy.referenceValue),
      percentage:
        product.depositPolicy?.percentage == null
          ? null
          : toNumber(product.depositPolicy.percentage),
    },
    imageMediaIds,
    imageUrls:
      product.imageUrls && product.imageUrls.length > 0
        ? product.imageUrls
        : directUrls.length > 0
          ? directUrls
          : [PRODUCT_FALLBACK_IMAGE],
    spec: product.spec ?? {},
    recommendationTags: product.recommendationTags ?? [],
  };
}

export function getStaffInventoryErrorMessage(
  error: unknown,
  fallback = "Không thể kết nối tới API kho thiết bị.",
) {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data;

    if (isRecord(responseData)) {
      const apiError = responseData.error;

      if (isRecord(apiError) && typeof apiError.message === "string") {
        return apiError.message;
      }

      if (typeof responseData.message === "string") {
        return responseData.message;
      }
    }

    if (error.response?.status === 401) {
      return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại tài khoản Staff Inventory.";
    }

    if (error.response?.status === 403) {
      return "Tài khoản hiện tại không có quyền Staff Inventory.";
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export async function getStaffRentalProducts(options?: {
  page?: number;
  pageSize?: number;
  status?: StaffRentalProductStatus;
  signal?: AbortSignal;
}): Promise<ApiPaginatedResult<RentalProduct>> {
  const response = await apiClient.get<unknown>(
    "/api/v1/staff/rental-products",
    {
      params: {
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 100,
        status: options?.status,
      },
      signal: options?.signal,
    },
  );

  const result = unwrapApiData<ApiPaginatedResult<ApiRentalProduct>>(
    response.data,
  );

  return {
    items: result.items.map(mapStaffProduct),
    pagination: result.pagination,
  };
}

export async function getInventoryLocations(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  signal?: AbortSignal;
}): Promise<ApiPaginatedResult<InventoryLocation>> {
  const response = await apiClient.get<unknown>(
    "/api/v1/staff/inventory-locations",
    {
      params: {
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 100,
        search: options?.search?.trim() || undefined,
        status: options?.status ?? "ACTIVE",
      },
      signal: options?.signal,
    },
  );

  return unwrapApiData<ApiPaginatedResult<InventoryLocation>>(response.data);
}

export async function getEquipmentUnits(
  options?: ListEquipmentUnitsOptions,
): Promise<{
  items: EquipmentUnit[];
  pagination: RentalPagination;
  counts: EquipmentUnitCounts;
}> {
  const response = await apiClient.get<unknown>(
    "/api/v1/staff/equipment-units",
    {
      params: {
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 20,
        productId: options?.productId || undefined,
        status: options?.status || undefined,
        condition: options?.condition || undefined,
        inventoryLocationId: options?.inventoryLocationId || undefined,
        q: options?.q?.trim() || undefined,
      },
      signal: options?.signal,
    },
  );

  return unwrapApiData<{
    items: EquipmentUnit[];
    pagination: RentalPagination;
    counts: EquipmentUnitCounts;
  }>(response.data);
}

export async function getEquipmentUnit(
  id: string,
  signal?: AbortSignal,
): Promise<EquipmentUnitDetail> {
  const response = await apiClient.get<unknown>(
    `/api/v1/staff/equipment-units/${encodeURIComponent(id)}`,
    { signal },
  );

  return unwrapApiData<EquipmentUnitDetail>(response.data);
}

export async function createEquipmentUnit(
  input: CreateEquipmentUnitInput,
): Promise<EquipmentUnit> {
  const response = await apiClient.post<unknown>(
    "/api/v1/staff/equipment-units",
    input,
  );

  return unwrapApiData<EquipmentUnit>(response.data);
}

export async function batchCreateEquipmentUnits(
  input: BatchCreateEquipmentUnitsInput,
): Promise<{ createdUnits: EquipmentUnit[] }> {
  const response = await apiClient.post<unknown>(
    "/api/v1/staff/equipment-units/batch",
    input,
  );

  return unwrapApiData<{ createdUnits: EquipmentUnit[] }>(response.data);
}

export async function updateEquipmentUnit(
  id: string,
  input: UpdateEquipmentUnitInput,
): Promise<EquipmentUnit> {
  const response = await apiClient.patch<unknown>(
    `/api/v1/staff/equipment-units/${encodeURIComponent(id)}`,
    input,
  );

  return unwrapApiData<EquipmentUnit>(response.data);
}

export async function generateEquipmentLabels(
  unitIds: string[],
): Promise<{ labels: EquipmentLabel[] }> {
  const response = await apiClient.post<unknown>(
    "/api/v1/staff/equipment-units/labels",
    { unitIds },
  );

  return unwrapApiData<{ labels: EquipmentLabel[] }>(response.data);
}

export async function changeEquipmentMaintenance(
  id: string,
  input: ChangeEquipmentMaintenanceInput,
): Promise<{
  unit: EquipmentUnit;
  maintenance: {
    id: string;
    status: string;
    reason: string;
    notes: string | null;
    startAt: string;
    completedAt: string | null;
    version: number;
  };
  affectedOrders?: unknown[];
  affectedOrdersEvaluated?: boolean;
}> {
  const response = await apiClient.post<unknown>(
    `/api/v1/staff/equipment-units/${encodeURIComponent(id)}/maintenance`,
    input,
  );

  return unwrapApiData(response.data);
}
