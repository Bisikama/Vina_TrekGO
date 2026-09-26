import { ApiClientError, getJson } from '@/services/api-client';
import type {
  RentalCatalogData,
  RentalCategory,
  RentalEligibility,
  RentalProduct,
  RentalRecommendation,
} from '@/features/rentals/types/rental-catalog';

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): JsonRecord {
  if (!isRecord(value)) throw invalidContract(field);
  return value;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw invalidContract(field);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw invalidContract(field);
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalidContract(field);
  return value;
}

function invalidContract(field: string) {
  return new ApiClientError({
    code: 'INVALID_API_CONTRACT',
    message: `Response thiếu hoặc sai field ${field}.`,
  });
}

function getData(payload: unknown): JsonRecord {
  return requireRecord(requireRecord(payload, 'response').data, 'data');
}

function parseEligibility(payload: unknown): RentalEligibility {
  const data = getData(payload);
  const trip = requireRecord(data.trip, 'data.trip');

  if (typeof data.eligible !== 'boolean') throw invalidContract('data.eligible');

  return {
    bookingId: requireString(data.bookingId, 'data.bookingId'),
    eligible: data.eligible,
    reason: data.reason == null ? null : requireString(data.reason, 'data.reason'),
    trip: {
      id: requireString(trip.id, 'data.trip.id'),
      name: requireString(trip.name, 'data.trip.name'),
      startAt: requireString(trip.startAt, 'data.trip.startAt'),
      endAt: requireString(trip.endAt, 'data.trip.endAt'),
      timezone: requireString(trip.timezone, 'data.trip.timezone'),
    },
    rentalCutoffAt: requireString(data.rentalCutoffAt, 'data.rentalCutoffAt'),
  };
}

function parseCategory(value: unknown): RentalCategory {
  const category = requireRecord(value, 'category');
  return {
    id: requireString(category.id, 'category.id'),
    name: requireString(category.name, 'category.name'),
  };
}

function parseCategories(payload: unknown): RentalCategory[] {
  return requireArray(getData(payload).items, 'data.items').map(parseCategory);
}

function parseProduct(value: unknown): RentalProduct {
  const product = requireRecord(value, 'product');
  const depositPolicy = requireRecord(product.depositPolicy, 'product.depositPolicy');
  const imageUrls = requireArray(product.imageUrls, 'product.imageUrls');

  return {
    id: requireString(product.id, 'product.id'),
    name: requireString(product.name, 'product.name'),
    description: requireString(product.description, 'product.description'),
    category: parseCategory(product.category),
    dailyPrice: requireNumber(product.dailyPrice, 'product.dailyPrice'),
    depositAmount: requireNumber(depositPolicy.amount, 'product.depositPolicy.amount'),
    currency: requireString(product.currency, 'product.currency'),
    imageUrl: imageUrls.length ? requireString(imageUrls[0], 'product.imageUrls[0]') : null,
    spec: requireRecord(product.spec, 'product.spec'),
  };
}

function parseProducts(payload: unknown): RentalProduct[] {
  return requireArray(getData(payload).items, 'data.items').map(parseProduct);
}

function parseRecommendations(payload: unknown): RentalRecommendation[] {
  return requireArray(getData(payload).recommendations, 'data.recommendations').map((value) => {
    const recommendation = requireRecord(value, 'recommendation');
    const source = requireString(recommendation.source, 'recommendation.source');
    if (source !== 'RULE' && source !== 'AI') throw invalidContract('recommendation.source');

    return {
      productId: requireString(recommendation.productId, 'recommendation.productId'),
      reasons: requireArray(recommendation.reasons, 'recommendation.reasons').map((reason) =>
        requireString(reason, 'recommendation.reason'),
      ),
      source,
    };
  });
}

function parseAvailableCount(payload: unknown) {
  return requireNumber(getData(payload).availableCount, 'data.availableCount');
}

export async function getRentalCatalog(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalCatalogData> {
  const eligibility = parseEligibility(
    await getJson(`/api/v1/bookings/${encodeURIComponent(bookingId)}/rental-eligibility`, {
      signal,
    }),
  );

  if (!eligibility.eligible) {
    return { eligibility, categories: [], items: [] };
  }

  const [productsPayload, categoriesPayload, recommendationsPayload] = await Promise.all([
    getJson('/api/v1/rental-products', { signal }),
    getJson('/api/v1/rental-categories', { signal }),
    getJson(`/api/v1/bookings/${encodeURIComponent(bookingId)}/rental-recommendations`, {
      query: { limit: 6 },
      signal,
    }),
  ]);

  const products = parseProducts(productsPayload);
  const categories = parseCategories(categoriesPayload);
  const recommendations = parseRecommendations(recommendationsPayload);
  const recommendationByProduct = new Map(
    recommendations.map((recommendation) => [recommendation.productId, recommendation]),
  );

  const availability = await Promise.all(
    products.map(async (product) => ({
      productId: product.id,
      availableCount: parseAvailableCount(
        await getJson('/api/v1/rentals/availability', {
          query: { bookingId, productId: product.id },
          signal,
        }),
      ),
    })),
  );
  const availabilityByProduct = new Map(
    availability.map((item) => [item.productId, item.availableCount]),
  );

  return {
    eligibility,
    categories,
    items: products.map((product) => ({
      ...product,
      availableCount: availabilityByProduct.get(product.id) ?? 0,
      recommendation: recommendationByProduct.get(product.id) ?? null,
    })),
  };
}
