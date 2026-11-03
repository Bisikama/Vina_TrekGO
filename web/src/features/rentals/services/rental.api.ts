import axios from "axios";

import { apiClient } from "@/lib/axios";
import type {
  CreateRentalOrderResult,
  CreateRentalQuoteInput,
  RentalAvailability,
  RentalCatalogData,
  RentalCategory,
  RentalDepositExplanation,
  RentalDepositPolicy,
  RentalEligibility,
  RentalGrade,
  RentalPagination,
  RentalPaymentCheckoutResponse,
  RentalPaymentGateway,
  RentalPaymentMethod,
  RentalPaymentOptions,
  RentalProduct,
  RentalProductDetailData,
  RentalQuote,
  RentalRecommendationsData,
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
  depositPerUnit?: number | string | null;
  depositExplanation?: {
    percentageOfReplacementValue?: number | string | null;
    formula?: string | null;
  } | null;
  grade?: string | null;
  gradeGroupId?: string | null;
  status?: string;
  version?: number;
  imageMediaIds?: string[];
  spec?: Record<string, unknown> | null;
  recommendationTags?: string[];
};

type MediaDelivery = {
  url: string;
};

const PRODUCT_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85";

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

function toNullableNumber(
  value: number | string | null | undefined,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function mapDepositExplanation(
  explanation: ApiRentalProduct["depositExplanation"],
): RentalDepositExplanation | null {
  if (!explanation) {
    return null;
  }

  return {
    percentageOfReplacementValue: toNullableNumber(
      explanation.percentageOfReplacementValue,
    ),
    formula: explanation.formula ?? null,
  };
}

function mapGrade(value: string | null | undefined): RentalGrade | null {
  return value === "LIKE_NEW" || value === "GOOD_USED" ? value : null;
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

  return directUrls.length > 0
    ? directUrls
    : [PRODUCT_FALLBACK_IMAGE];
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
    depositPerUnit: toNullableNumber(product.depositPerUnit),
    depositExplanation: mapDepositExplanation(
      product.depositExplanation,
    ),
    grade: mapGrade(product.grade),
    gradeGroupId: product.gradeGroupId ?? null,
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

async function resolveProductImages(
  product: RentalProduct,
  variant: "CATALOG_CARD" | "CATALOG_DETAIL",
  signal?: AbortSignal,
): Promise<RentalProduct> {
  const mediaIds = (product.imageMediaIds ?? []).filter(
    (value) =>
      !value.startsWith("http://") &&
      !value.startsWith("https://"),
  );

  if (mediaIds.length === 0) {
    return product;
  }

  const deliveries = await Promise.allSettled(
    mediaIds.map(async (mediaId) => {
      const response = await apiClient.get<unknown>(
        `/api/v1/media/${encodeURIComponent(
          mediaId,
        )}/delivery`,
        {
          params: { variant, format: "WEBP" },
          signal,
        },
      );

      return unwrapApiData<MediaDelivery>(response.data).url;
    }),
  );

  const resolvedUrls = deliveries.flatMap((delivery) =>
    delivery.status === "fulfilled" && delivery.value
      ? [delivery.value]
      : [],
  );

  return resolvedUrls.length > 0
    ? { ...product, imageUrls: resolvedUrls }
    : product;
}

export function getRentalApiErrorCode(error: unknown) {
  if (!axios.isAxiosError(error)) return null;

  const responseData: unknown = error.response?.data;
  if (!isRecord(responseData)) return null;

  const apiError = responseData.error;
  return isRecord(apiError) && typeof apiError.code === "string"
    ? apiError.code
    : null;
}

export function getRentalApiErrorMessage(
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

    if (error.response?.status === 401) {
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    }

    if (error.response?.status === 403) {
      return "Bạn không có quyền thao tác với booking này.";
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
        params: { page: 1, pageSize: 100 },
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
      getRentalApiErrorMessage(
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
          pageSize: options?.pageSize ?? 24,
          search: options?.search?.trim() || undefined,
          categoryId: options?.categoryId || undefined,
        },
        signal: options?.signal,
      },
    );

    const result = unwrapApiData<
      ApiPaginatedResult<ApiRentalProduct>
    >(response.data);

    const items = await Promise.all(
      result.items.map((product) =>
        resolveProductImages(
          mapProduct(product),
          "CATALOG_CARD",
          options?.signal,
        ),
      ),
    );

    return {
      items,
      pagination: result.pagination,
    };
  } catch (error) {
    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể tải danh sách thiết bị thuê.",
      ),
    );
  }
}

export async function getRentalProduct(
  productId: string,
  signal?: AbortSignal,
) {
  try {
    const response = await apiClient.get<unknown>(
      `/api/v1/rental-products/${encodeURIComponent(
        productId,
      )}`,
      { signal },
    );

    return resolveProductImages(
      mapProduct(
        unwrapApiData<ApiRentalProduct>(response.data),
      ),
      "CATALOG_DETAIL",
      signal,
    );
  } catch (error) {
    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể tải thông tin sản phẩm thuê.",
      ),
    );
  }
}

export async function getRentalEligibility(
  bookingId: string,
  signal?: AbortSignal,
) {
  try {
    const response = await apiClient.get<unknown>(
      `/api/v1/trips/${encodeURIComponent(
        bookingId,
      )}/rental-eligibility`,
      { signal },
    );

    return unwrapApiData<RentalEligibility>(response.data);
  } catch (error) {
    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể kiểm tra điều kiện thuê thiết bị.",
      ),
    );
  }
}

export async function getRentalAvailability(
  bookingId: string,
  productId: string,
  signal?: AbortSignal,
) {
  try {
    const response = await apiClient.get<unknown>(
      "/api/v1/rentals/availability",
      {
        params: { tripId: bookingId, productId },
        signal,
      },
    );

    return unwrapApiData<RentalAvailability>(
      response.data,
    );
  } catch (error) {
    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể kiểm tra số lượng thiết bị khả dụng.",
      ),
    );
  }
}

export async function getRentalRecommendations(
  bookingId: string,
  options?: {
    categoryId?: string;
    limit?: number;
    signal?: AbortSignal;
  },
) {
  try {
    const response = await apiClient.get<unknown>(
      `/api/v1/trips/${encodeURIComponent(
        bookingId,
      )}/rental-recommendations`,
      {
        params: {
          categoryId: options?.categoryId || undefined,
          limit: options?.limit ?? 24,
        },
        signal: options?.signal,
      },
    );

    return unwrapApiData<RentalRecommendationsData>(
      response.data,
    );
  } catch (error) {
    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể tải gợi ý thiết bị cho chuyến đi.",
      ),
    );
  }
}

export async function createRentalQuote(
  input: CreateRentalQuoteInput,
  signal?: AbortSignal,
) {
  try {
    const response = await apiClient.post<unknown>(
      "/api/v1/rentals/quote",
      input,
      { signal },
    );

    return unwrapApiData<RentalQuote>(response.data);
  } catch (error) {
    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể tạo báo giá thuê thiết bị.",
      ),
    );
  }
}

export async function getRentalPaymentOptions(
  signal?: AbortSignal,
) {
  try {
    const response = await apiClient.get<unknown>(
      "/api/v1/payments/options",
      { signal },
    );
    const result =
      unwrapApiData<RentalPaymentOptions>(response.data);

    return {
      gateways: result.gateways.filter(
        (option) =>
          option.gateway === "momo" ||
          option.gateway === "vnpay",
      ),
    } satisfies RentalPaymentOptions;
  } catch (error) {
    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể tải các cổng thanh toán hiện có.",
      ),
    );
  }
}

export async function createRentalOrder(
  quoteId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  try {
    const response = await apiClient.post<unknown>(
      "/api/v1/rental-orders",
      { quoteId },
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        signal,
      },
    );

    return unwrapApiData<CreateRentalOrderResult>(
      response.data,
    );
  } catch (error) {
    // Preserve the backend error envelope so checkout can recover from
    // STALE_CONTEXT instead of retrying an obsolete quote.
    if (axios.isAxiosError(error)) throw error;

    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể giữ thiết bị và tạo đơn thuê.",
      ),
    );
  }
}

export async function createRentalPayment(
  orderId: string,
  input: {
    paymentMethod: RentalPaymentMethod;
    gateway: RentalPaymentGateway;
  },
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  try {
    const response = await apiClient.post<unknown>(
      `/api/v1/rental-orders/${encodeURIComponent(
        orderId,
      )}/payments`,
      input,
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        signal,
      },
    );

    return unwrapApiData<RentalPaymentCheckoutResponse>(
      response.data,
    );
  } catch (error) {
    throw new Error(
      getRentalApiErrorMessage(
        error,
        "Không thể khởi tạo thanh toán cho đơn thuê.",
      ),
    );
  }
}

export async function getRentalCatalog(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalCatalogData> {
  const [eligibility, categoryResult, productResult] =
    await Promise.all([
      getRentalEligibility(bookingId, signal),
      getRentalCategories(signal),
      getRentalProducts({
        page: 1,
        pageSize: 24,
        signal,
      }),
    ]);

  if (!eligibility.eligible) {
    return {
      eligibility,
      categories: categoryResult.items,
      items: productResult.items.map((product) => ({
        ...product,
        availableCount: 0,
        recommendation: null,
      })),
      pagination: productResult.pagination,
    };
  }

  const [recommendationResult, availabilityResults] = await Promise.all([
    getRentalRecommendations(bookingId, {
      limit: Math.min(productResult.items.length || 1, 50),
      signal,
    }),
    Promise.allSettled(
      productResult.items.map((product) =>
        getRentalAvailability(bookingId, product.id, signal),
      ),
    ),
  ]);

  const recommendationMap = new Map(
    recommendationResult.recommendations.map((item) => [
      item.productId,
      item,
    ]),
  );

  return {
    eligibility,
    categories: categoryResult.items,
    items: productResult.items.map((product, index) => {
      const availability = availabilityResults[index];

      return {
        ...product,
        availableCount:
          availability.status === "fulfilled"
            ? availability.value.availableCount
            : null,
        recommendation:
          recommendationMap.get(product.id) ?? null,
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
  const [product, eligibility] = await Promise.all([
    getRentalProduct(productId, signal),
    getRentalEligibility(bookingId, signal),
  ]);

  if (!eligibility.eligible) {
    throw new Error(
      eligibility.reason ??
        "Booking hiện tại chưa đủ điều kiện thuê thiết bị.",
    );
  }

  const [availability, recommendationResult] =
    await Promise.all([
      getRentalAvailability(
        bookingId,
        productId,
        signal,
      ),
      getRentalRecommendations(bookingId, {
        limit: 50,
        signal,
      }),
    ]);

  return {
    product,
    eligibility,
    availability,
    recommendation:
      recommendationResult.recommendations.find(
        (item) => item.productId === productId,
      ) ?? null,
    tripSummary: recommendationResult.tripSummary,
  };
}
