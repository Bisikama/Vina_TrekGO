import { apiClient } from "@/lib/axios";

import type {
  RentalAvailability,
  RentalCatalogData,
  RentalCategory,
  RentalEligibility,
  RentalProduct,
  RentalProductDetailData,
  RentalRecommendation,
  RentalTripSummary,
} from "@/features/rentals/types/rental";

type ApiEnvelope<T> = {
  statusCode?: number;
  message?: string;
  data: T;
};

type RentalProductsPayload = {
  items: RentalProduct[];
};

type RentalCategoriesPayload = {
  items: RentalCategory[];
};

type RentalRecommendationsPayload = {
  tripSummary: RentalTripSummary;
  recommendations: RentalRecommendation[];
};

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8765";

function normalizeAssetUrl(value: string): string {
  try {
    const baseUrl = new URL(apiBaseUrl);
    const assetUrl = new URL(value, baseUrl);

    if (
      assetUrl.hostname === "localhost" ||
      assetUrl.hostname === "127.0.0.1"
    ) {
      return `${baseUrl.origin}${assetUrl.pathname}${assetUrl.search}`;
    }

    return assetUrl.toString();
  } catch {
    return value;
  }
}

function normalizeProduct(product: RentalProduct): RentalProduct {
  return {
    ...product,
    imageUrls: Array.isArray(product.imageUrls)
      ? product.imageUrls.map(normalizeAssetUrl)
      : [],
  };
}

async function getData<T>(
  url: string,
  options?: {
    params?: Record<string, string | number>;
    signal?: AbortSignal;
  },
): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(url, {
    params: options?.params,
    signal: options?.signal,
  });

  if (!response.data || response.data.data == null) {
    throw new Error("API trả về dữ liệu không hợp lệ.");
  }

  return response.data.data;
}

export async function getRentalCatalog(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalCatalogData> {
  const eligibility = await getData<RentalEligibility>(
    `/api/v1/bookings/${encodeURIComponent(
      bookingId,
    )}/rental-eligibility`,
    { signal },
  );

  if (!eligibility.eligible) {
    return {
      eligibility,
      categories: [],
      items: [],
    };
  }

  const [productsPayload, categoriesPayload, recommendationsPayload] =
    await Promise.all([
      getData<RentalProductsPayload>("/api/v1/rental-products", {
        signal,
      }),

      getData<RentalCategoriesPayload>("/api/v1/rental-categories", {
        signal,
      }),

      getData<RentalRecommendationsPayload>(
        `/api/v1/bookings/${encodeURIComponent(
          bookingId,
        )}/rental-recommendations`,
        {
          params: { limit: 6 },
          signal,
        },
      ),
    ]);

  const products = productsPayload.items.map(normalizeProduct);

  const availability = await Promise.all(
    products.map((product) =>
      getData<RentalAvailability>("/api/v1/rentals/availability", {
        params: {
          bookingId,
          productId: product.id,
        },
        signal,
      }),
    ),
  );

  const availabilityByProduct = new Map(
    availability.map((item) => [
      item.productId,
      item.availableCount,
    ]),
  );

  const recommendationByProduct = new Map(
    recommendationsPayload.recommendations.map((item) => [
      item.productId,
      item,
    ]),
  );

  return {
    eligibility,
    categories: categoriesPayload.items,
    items: products.map((product) => ({
      ...product,
      availableCount:
        availabilityByProduct.get(product.id) ?? 0,
      recommendation:
        recommendationByProduct.get(product.id) ?? null,
    })),
  };
}

export async function getRentalProductDetail(
  productId: string,
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalProductDetailData> {
  const [product, availability, recommendationsPayload] =
    await Promise.all([
      getData<RentalProduct>(
        `/api/v1/rental-products/${encodeURIComponent(
          productId,
        )}`,
        { signal },
      ),

      getData<RentalAvailability>("/api/v1/rentals/availability", {
        params: {
          bookingId,
          productId,
        },
        signal,
      }),

      getData<RentalRecommendationsPayload>(
        `/api/v1/bookings/${encodeURIComponent(
          bookingId,
        )}/rental-recommendations`,
        {
          params: { limit: 6 },
          signal,
        },
      ),
    ]);

  const normalizedProduct = normalizeProduct(product);

  return {
    product: normalizedProduct,
    availability,
    tripSummary: recommendationsPayload.tripSummary,
    recommendation:
      recommendationsPayload.recommendations.find(
        (item) => item.productId === normalizedProduct.id,
      ) ?? null,
  };
}