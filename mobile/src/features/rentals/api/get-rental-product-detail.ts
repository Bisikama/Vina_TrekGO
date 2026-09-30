import {
  rentalDemoProducts,
  rentalDemoRecommendations,
  rentalDemoStock,
  waitForRentalDemo,
} from '@/features/rentals/api/get-rental-catalog';

import type { RentalProductDetailData } from '@/features/rentals/types/rental-product-detail';

export async function getRentalProductDetail(
  productId: string,
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalProductDetailData> {
  await waitForRentalDemo(signal);

  const product =
    rentalDemoProducts.find(
      (item) =>
        item.id === productId,
    );

  if (!product) {
    throw new Error(
      'Không tìm thấy thiết bị demo.',
    );
  }

  const recommendation =
    rentalDemoRecommendations.find(
      (item) =>
        item.productId === productId,
    ) ?? null;

  return {
    product,

    availability: {
      bookingId,
      productId,
      availableCount:
        rentalDemoStock[productId] ?? 0,

      rentalWindow: {
        occupiedFrom:
          '2026-11-18T06:00:00+07:00',
        occupiedUntil:
          '2026-11-20T17:00:00+07:00',
      },

      checkedAt:
        '2026-09-30T09:00:00Z',
    },

    recommendation,

    tripSummary: {
      tripId: 'trip_fansipan_3n2d',
      name: 'Chinh phục Đỉnh Fansipan 3N2Đ',
      durationDays: 3,
      difficulty:
        'VFRS Cấp 3 — Thử thách',
      weatherSummary:
        'Nhiệt độ 6–14°C, có sương và gió mạnh ở vùng cao.',
    },
  };
}