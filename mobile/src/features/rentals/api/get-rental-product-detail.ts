import type {
  RentalCategory,
  RentalRecommendation,
} from '@/features/rentals/types/rental-catalog';

import type {
  RentalAvailability,
  RentalProductDetail,
  RentalProductDetailData,
  RentalTripSummary,
} from '@/features/rentals/types/rental-product-detail';

import {
  ApiClientError,
  getJson,
  resolveApiAssetUrl,
} from '@/services/api-client';

type JsonRecord = Record<
  string,
  unknown
>;

function invalidContract(
  field: string,
) {
  return new ApiClientError({
    code: 'INVALID_API_CONTRACT',
    message: `Response thiếu hoặc sai field ${field}.`,
  });
}

function requireRecord(
  value: unknown,
  field: string,
): JsonRecord {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw invalidContract(field);
  }

  return value as JsonRecord;
}

function requireArray(
  value: unknown,
  field: string,
): unknown[] {
  if (!Array.isArray(value)) {
    throw invalidContract(field);
  }

  return value;
}

function requireString(
  value: unknown,
  field: string,
): string {
  if (typeof value !== 'string') {
    throw invalidContract(field);
  }

  return value;
}

function requireNumber(
  value: unknown,
  field: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    throw invalidContract(field);
  }

  return value;
}

function optionalNumber(
  value: unknown,
  field: string,
): number | null {
  if (value == null) {
    return null;
  }

  return requireNumber(
    value,
    field,
  );
}

function getData(
  payload: unknown,
): JsonRecord {
  const response = requireRecord(
    payload,
    'response',
  );

  return requireRecord(
    response.data,
    'data',
  );
}

function parseCategory(
  value: unknown,
): RentalCategory {
  const category = requireRecord(
    value,
    'data.category',
  );

  return {
    id: requireString(
      category.id,
      'data.category.id',
    ),

    name: requireString(
      category.name,
      'data.category.name',
    ),
  };
}

function parseProduct(
  payload: unknown,
): RentalProductDetail {
  const data = getData(payload);

  const depositPolicy =
    requireRecord(
      data.depositPolicy,
      'data.depositPolicy',
    );

  return {
    id: requireString(
      data.id,
      'data.id',
    ),

    sku: requireString(
      data.sku,
      'data.sku',
    ),

    name: requireString(
      data.name,
      'data.name',
    ),

    category: parseCategory(
      data.category,
    ),

    description: requireString(
      data.description,
      'data.description',
    ),

    dailyPrice: requireNumber(
      data.dailyPrice,
      'data.dailyPrice',
    ),

    depositPolicy: {
      type: requireString(
        depositPolicy.type,
        'data.depositPolicy.type',
      ),

      amount: requireNumber(
        depositPolicy.amount,
        'data.depositPolicy.amount',
      ),

      referenceValue:
        optionalNumber(
          depositPolicy.referenceValue,
          'data.depositPolicy.referenceValue',
        ),

      percentage:
        optionalNumber(
          depositPolicy.percentage,
          'data.depositPolicy.percentage',
        ),
    },

    currency: requireString(
      data.currency,
      'data.currency',
    ),

    status: requireString(
      data.status,
      'data.status',
    ),

    imageUrls: requireArray(
      data.imageUrls,
      'data.imageUrls',
    ).map((value) =>
      resolveApiAssetUrl(
        requireString(
          value,
          'data.imageUrls[]',
        ),
      ),
    ),

    spec: requireRecord(
      data.spec,
      'data.spec',
    ),

    recommendationTags:
      requireArray(
        data.recommendationTags,
        'data.recommendationTags',
      ).map((value) =>
        requireString(
          value,
          'data.recommendationTags[]',
        ),
      ),
  };
}

function parseAvailability(
  payload: unknown,
): RentalAvailability {
  const data = getData(payload);

  const rentalWindow =
    requireRecord(
      data.rentalWindow,
      'data.rentalWindow',
    );

  return {
    bookingId: requireString(
      data.bookingId,
      'data.bookingId',
    ),

    productId: requireString(
      data.productId,
      'data.productId',
    ),

    availableCount:
      requireNumber(
        data.availableCount,
        'data.availableCount',
      ),

    rentalWindow: {
      occupiedFrom:
        requireString(
          rentalWindow.occupiedFrom,
          'data.rentalWindow.occupiedFrom',
        ),

      occupiedUntil:
        requireString(
          rentalWindow.occupiedUntil,
          'data.rentalWindow.occupiedUntil',
        ),
    },

    checkedAt: requireString(
      data.checkedAt,
      'data.checkedAt',
    ),
  };
}

function parseRecommendations(
  payload: unknown,
): {
  tripSummary: RentalTripSummary;
  recommendations:
    RentalRecommendation[];
} {
  const data = getData(payload);

  const tripSummary =
    requireRecord(
      data.tripSummary,
      'data.tripSummary',
    );

  return {
    tripSummary: {
      tripId: requireString(
        tripSummary.tripId,
        'data.tripSummary.tripId',
      ),

      name: requireString(
        tripSummary.name,
        'data.tripSummary.name',
      ),

      durationDays:
        requireNumber(
          tripSummary.durationDays,
          'data.tripSummary.durationDays',
        ),

      difficulty:
        requireString(
          tripSummary.difficulty,
          'data.tripSummary.difficulty',
        ),

      weatherSummary:
        tripSummary.weatherSummary ==
        null
          ? null
          : requireString(
              tripSummary.weatherSummary,
              'data.tripSummary.weatherSummary',
            ),
    },

    recommendations:
      requireArray(
        data.recommendations,
        'data.recommendations',
      ).map((value) => {
        const recommendation =
          requireRecord(
            value,
            'data.recommendations[]',
          );

        const source =
          requireString(
            recommendation.source,
            'recommendation.source',
          );

        if (
          source !== 'RULE' &&
          source !== 'AI'
        ) {
          throw invalidContract(
            'recommendation.source',
          );
        }

        return {
          productId:
            requireString(
              recommendation.productId,
              'recommendation.productId',
            ),

          reasons:
            requireArray(
              recommendation.reasons,
              'recommendation.reasons',
            ).map((reason) =>
              requireString(
                reason,
                'recommendation.reasons[]',
              ),
            ),

          source,
        };
      }),
  };
}

export async function getRentalProductDetail(
  productId: string,
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalProductDetailData> {
  const [
    productPayload,
    availabilityPayload,
    recommendationsPayload,
  ] = await Promise.all([
    getJson(
      `/api/v1/rental-products/${encodeURIComponent(
        productId,
      )}`,
      {
        signal,
      },
    ),

    getJson(
      '/api/v1/rentals/availability',
      {
        query: {
          bookingId,
          productId,
        },
        signal,
      },
    ),

    getJson(
      `/api/v1/bookings/${encodeURIComponent(
        bookingId,
      )}/rental-recommendations`,
      {
        query: {
          limit: 6,
        },
        signal,
      },
    ),
  ]);

  const product =
    parseProduct(productPayload);

  const availability =
    parseAvailability(
      availabilityPayload,
    );

  const {
    tripSummary,
    recommendations,
  } = parseRecommendations(
    recommendationsPayload,
  );

  return {
    product,
    availability,
    tripSummary,

    recommendation:
      recommendations.find(
        (recommendation) =>
          recommendation.productId ===
          product.id,
      ) ?? null,
  };
}