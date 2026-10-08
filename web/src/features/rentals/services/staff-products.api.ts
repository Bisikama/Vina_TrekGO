import axios from "axios";

import { apiClient } from "@/lib/axios";
import type {
  ChangeStaffRentalProductStatusInput,
  CreateStaffRentalProductInput,
  RentalPagination,
  RentalProduct,
  StaffRentalProductStatus,
  UpdateStaffRentalProductInput,
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
    replacementValue: toNumber(product.replacementValue),
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

export function getStaffProductErrorMessage(
  error: unknown,
  fallback = "Không thể kết nối tới API danh mục cho thuê.",
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
      return "Tài khoản hiện tại không có quyền quản lý danh mục cho thuê.";
    }

    if (error.response?.status === 409) {
      return "Dữ liệu đã được người khác cập nhật. Hãy tải lại danh sách rồi thử lại.";
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

export async function listStaffRentalProducts(options?: {
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
        pageSize: options?.pageSize ?? 20,
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

export async function createStaffRentalProduct(
  input: CreateStaffRentalProductInput,
) {
  const response = await apiClient.post<unknown>(
    "/api/v1/staff/rental-products",
    input,
  );

  return unwrapApiData<{ id: string; sku: string }>(response.data);
}

export async function updateStaffRentalProduct(
  productId: string,
  input: UpdateStaffRentalProductInput,
) {
  const response = await apiClient.patch<unknown>(
    `/api/v1/staff/rental-products/${productId}`,
    input,
  );

  return unwrapApiData<{ id: string; version: number }>(response.data);
}

export async function changeStaffRentalProductStatus(
  productId: string,
  input: ChangeStaffRentalProductStatusInput,
) {
  const response = await apiClient.patch<unknown>(
    `/api/v1/staff/rental-products/${productId}/status`,
    input,
  );

  return unwrapApiData<{ id: string; version: number }>(response.data);
}
