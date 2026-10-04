import axios from "axios";

import { apiClient } from "@/lib/axios";
import type {
  RentalAvailability,
  RentalCatalogData,
  RentalCategory,
  RentalDepositPolicy,
  RentalEligibility,
  RentalPagination,
  RentalProduct,
  RentalProductDetailData,
  RentalRecommendation,
  RentalTripSummary,
} from "@/features/rentals/types/rental";

type ApiEnvelope<T> = {
  data: T;
};

type ApiPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type ApiPaginatedResult<T> = {
  items: T[];
  pagination: ApiPagination;
};

type ApiRentalCategory = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  status?: string;
};

type ApiDepositPolicy = {
  type: string;
  amount?: number | string | null;
  referenceValue?: number | string | null;
  percentage?: number | string | null;
};

type ApiRentalProduct = {
  id: string;
  sku?: string;
  name: string;
  category: ApiRentalCategory;
  description?: string | null;
  dailyPrice: number | string;
  depositPolicy: ApiDepositPolicy;
  currency?: string;
  replacementValue?: number | string;
  status?: string;
  version?: number;
  imageMediaIds?: string[];
  spec?: Record<string, unknown> | null;
  recommendationTags?: string[];
};

const PRODUCT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85";

const MOCK_TRIP_SUMMARY: RentalTripSummary = {
  tripId: "trip_001",
  name: "Tà Năng – Phan Dũng",
  durationDays: 3,
  difficulty: "Trung bình – Khó",
  weatherSummary:
    "Ban ngày 22–26°C, ban đêm 14–17°C, có khả năng mưa nhẹ.",
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapApiData<T>(payload: unknown): T {
  if (
    isRecord(payload) &&
    "data" in payload &&
    payload.data !== undefined
  ) {
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

function mapCategory(
  category: ApiRentalCategory,
): RentalCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    status: category.status,
  };
}

function mapDepositPolicy(
  policy: ApiDepositPolicy | undefined,
): RentalDepositPolicy {
  return {
    type: policy?.type ?? "FIXED",
    amount: toNumber(policy?.amount),
    referenceValue:
      policy?.referenceValue === undefined ||
      policy.referenceValue === null
        ? null
        : toNumber(policy.referenceValue),
    percentage:
      policy?.percentage === undefined ||
      policy.percentage === null
        ? null
        : toNumber(policy.percentage),
  };
}

function getProductImages(product: ApiRentalProduct) {
  const directUrls = (product.imageMediaIds ?? []).filter(
    (value) =>
      value.startsWith("http://") ||
      value.startsWith("https://"),
  );

  if (directUrls.length > 0) {
    return directUrls;
  }

  /*
   * BE hiện trả imageMediaIds thay vì URL ảnh hoàn chỉnh.
   * Tạm dùng ảnh dự phòng cho tới khi nối Media Delivery API.
   */
  return [PRODUCT_FALLBACK_IMAGE];
}

function mapProduct(
  product: ApiRentalProduct,
): RentalProduct {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: mapCategory(product.category),
    description: product.description ?? "",
    dailyPrice: toNumber(product.dailyPrice),
    depositPolicy: mapDepositPolicy(
      product.depositPolicy,
    ),
    currency: product.currency ?? "VND",
    replacementValue:
      product.replacementValue === undefined
        ? undefined
        : toNumber(product.replacementValue),
    status: product.status,
    version: product.version,
    imageMediaIds: [...(product.imageMediaIds ?? [])],
    imageUrls: getProductImages(product),
    spec: product.spec ?? {},
    recommendationTags: [
      ...(product.recommendationTags ?? []),
    ],
  };
}

function getApiErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data;

    if (isRecord(responseData)) {
      const apiError = responseData.error;

      if (
        isRecord(apiError) &&
        typeof apiError.message === "string"
      ) {
        return apiError.message;
      }

      if (typeof responseData.message === "string") {
        return responseData.message;
      }
    }

    if (error.code === "ERR_CANCELED") {
      return "Yêu cầu đã được hủy.";
    }

    if (error.message) {
      return error.message;
    }
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  return fallback;
}

/*
 * Các hàm mock bên dưới chỉ phục vụ những endpoint được mô tả
 * trong tài liệu nhưng chưa tồn tại trong source API/OpenAPI.
 */

function createMockEligibility(
  bookingId: string,
): RentalEligibility {
  return {
    bookingId,
    eligible: true,
    reason: null,
    trip: {
      id: "trip_001",
      name: "Tà Năng – Phan Dũng",
      startAt: "2026-10-10T01:00:00Z",
      endAt: "2026-10-12T10:00:00Z",
      timezone: "Asia/Ho_Chi_Minh",
    },
    rentalCutoffAt: "2026-10-09T00:00:00Z",
  };
}

function createStableMockCount(productId: string) {
  const hash = [...productId].reduce(
    (total, character) =>
      total + character.charCodeAt(0),
    0,
  );

  return 4 + (hash % 17);
}

function createMockAvailability(
  productId: string,
  bookingId: string,
): RentalAvailability {
  return {
    bookingId,
    productId,
    availableCount:
      createStableMockCount(productId),
    rentalWindow: {
      occupiedFrom: "2026-10-09T12:00:00Z",
      occupiedUntil: "2026-10-12T12:00:00Z",
    },
    checkedAt: new Date().toISOString(),
  };
}

function createMockRecommendation(
  product: RentalProduct,
): RentalRecommendation | null {
  const tags = product.recommendationTags ?? [];

  if (tags.length === 0) {
    return null;
  }

  return {
    productId: product.id,
    reasons: [
      `Phù hợp với chuyến đi dựa trên: ${tags.join(
        ", ",
      )}.`,
    ],
    source: "RULE",
  };
}

export async function getRentalCategories(
  signal?: AbortSignal,
): Promise<{
  items: RentalCategory[];
  pagination: RentalPagination;
}> {
  try {
    const response = await apiClient.get<unknown>(
      "/api/v1/rental-categories",
      {
        params: {
          page: 1,
          pageSize: 100,
        },
        signal,
      },
    );

    const result = unwrapApiData<
      ApiPaginatedResult<ApiRentalCategory>
    >(response.data);

    return {
      items: result.items.map(mapCategory),
      pagination: result.pagination,
    };
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Không thể tải danh mục thiết bị thuê.",
      ),
    );
  }
}

export async function getRentalProducts(
  options?: {
    search?: string;
    categoryId?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  },
): Promise<{
  items: RentalProduct[];
  pagination: RentalPagination;
}> {
  try {
    const response = await apiClient.get<unknown>(
      "/api/v1/rental-products",
      {
        params: {
          page: options?.page ?? 1,
          pageSize: options?.pageSize ?? 100,
          search:
            options?.search?.trim() || undefined,
          categoryId:
            options?.categoryId || undefined,
        },
        signal: options?.signal,
      },
    );

    const result = unwrapApiData<
      ApiPaginatedResult<ApiRentalProduct>
    >(response.data);

    return {
      items: result.items.map(mapProduct),
      pagination: result.pagination,
    };
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Không thể tải danh sách thiết bị thuê.",
      ),
    );
  }
}

export async function getRentalCatalog(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalCatalogData> {
  const [categoryResult, productResult] =
    await Promise.all([
      getRentalCategories(signal),
      getRentalProducts({
        page: 1,
        pageSize: 100,
        signal,
      }),
    ]);

  const eligibility =
    createMockEligibility(bookingId);

  return {
    eligibility,
    categories: categoryResult.items,
    items: productResult.items.map((product) => {
      const availability =
        createMockAvailability(
          product.id,
          bookingId,
        );

      return {
        ...product,
        availableCount:
          availability.availableCount,
        recommendation:
          createMockRecommendation(product),
      };
    }),
    pagination: productResult.pagination,
  };
}

export async function getRentalProductDetail(
  productId: string,
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalProductDetailData> {
  try {
    const response = await apiClient.get<unknown>(
      `/api/v1/rental-products/${encodeURIComponent(
        productId,
      )}`,
      {
        signal,
      },
    );

    const apiProduct =
      unwrapApiData<ApiRentalProduct>(
        response.data,
      );

    const product = mapProduct(apiProduct);

    return {
      product,
      availability: createMockAvailability(
        product.id,
        bookingId,
      ),
      recommendation:
        createMockRecommendation(product),
      tripSummary: {
        ...MOCK_TRIP_SUMMARY,
      },
    };
  } catch (error) {
    throw new Error(
      getApiErrorMessage(
        error,
        "Không thể tải thông tin sản phẩm thuê.",
      ),
    );
  }
}