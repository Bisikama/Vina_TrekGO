import type {
  RentalCatalogData,
  RentalCategory,
  RentalRecommendation,
} from '@/features/rentals/types/rental-catalog';
import type { RentalProductDetail } from '@/features/rentals/types/rental-product-detail';

const tentCategory = {
  id: 'tent',
  name: 'Lều & Tăng',
} satisfies RentalCategory;

const sleepingCategory = {
  id: 'sleeping',
  name: 'Túi ngủ & Đệm',
} satisfies RentalCategory;

const poleCategory = {
  id: 'pole',
  name: 'Gậy leo núi',
} satisfies RentalCategory;

const safetyCategory = {
  id: 'safety',
  name: 'Đèn & GPS cứu hộ',
} satisfies RentalCategory;

const categories: RentalCategory[] = [
  tentCategory,
  sleepingCategory,
  poleCategory,
  safetyCategory,
];

export const rentalDemoProducts: RentalProductDetail[] = [
  {
    id: 'prod_tent_4',
    sku: 'NH-CP2-GREEN',
    name: 'Lều dã ngoại 2 người Naturehike Cloud Peak 2',
    category: tentCategory,
    description:
      'Lều hai lớp chuyên dụng cho địa hình núi cao, cản gió cấp 8 và phù hợp hành trình Fansipan hoặc Bạch Mộc Lương Tử.',
    dailyPrice: 120_000,
    depositPolicy: {
      type: 'FIXED',
      amount: 800_000,
      referenceValue: null,
      percentage: null,
    },
    currency: 'VND',
    status: 'ACTIVE',
    imageUrls: [
      'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=85',
    ],
    spec: {
      capacityPeople: 2,
      weightKg: 2.4,
      season: '3 mùa',
      material: 'Polyester 20D phủ silicone',
      waterproof: true,
    },
    recommendationTags: [
      'VFRS chuẩn hoá',
      'Bắt buộc Fansipan',
      'Cản gió cấp 8',
    ],
  },
  {
    id: 'prod_sleeping_bag_1',
    sku: 'DF-DOWN-M5',
    name: 'Túi ngủ lông vũ Desert Fox -5°C',
    category: sleepingCategory,
    description:
      'Túi ngủ lông vũ giữ nhiệt dành cho đêm lạnh và môi trường có độ ẩm cao, kèm túi nén chống nước.',
    dailyPrice: 95_000,
    depositPolicy: {
      type: 'FIXED',
      amount: 500_000,
      referenceValue: null,
      percentage: null,
    },
    currency: 'VND',
    status: 'ACTIVE',
    imageUrls: [
      'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=1200&q=85',
    ],
    spec: {
      weightKg: 1.35,
      season: '4 mùa',
      material: 'Lông vũ 90/10',
      comfortTemperature: '-5°C',
      waterproof: true,
    },
    recommendationTags: [
      'Giữ nhiệt',
      'Chống ẩm sương muối',
    ],
  },
  {
    id: 'prod_poles_1',
    sku: 'BD-TRAIL-PRO',
    name: 'Gậy Carbon Black Diamond Trail Pro Shock',
    category: poleCategory,
    description:
      'Bộ hai gậy carbon siêu nhẹ, giảm chấn khi xuống dốc đá và sử dụng khóa FlickLock Pro chắc chắn.',
    dailyPrice: 45_000,
    depositPolicy: {
      type: 'FIXED',
      amount: 300_000,
      referenceValue: null,
      percentage: null,
    },
    currency: 'VND',
    status: 'ACTIVE',
    imageUrls: [
      'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85',
    ],
    spec: {
      weightKg: 0.48,
      material: 'Carbon',
      size: 'Điều chỉnh 68–140 cm',
      shockAbsorption: true,
    },
    recommendationTags: [
      'Giảm chấn dốc đá',
      'Siêu nhẹ',
    ],
  },
  {
    id: 'prod_gps_1',
    sku: 'GARMIN-IR-MINI2',
    name: 'Định vị vệ tinh Garmin inReach Mini 2',
    category: safetyCategory,
    description:
      'Thiết bị định vị vệ tinh tích hợp gửi tín hiệu SOS và chia sẻ vị trí cho hành trình ngoài vùng phủ sóng.',
    dailyPrice: 180_000,
    depositPolicy: {
      type: 'FIXED',
      amount: 2_500_000,
      referenceValue: null,
      percentage: null,
    },
    currency: 'VND',
    status: 'ACTIVE',
    imageUrls: [
      'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1200&q=85',
    ],
    spec: {
      weightKg: 0.1,
      batteryLife: 'Tối đa 14 ngày',
      waterproof: true,
      satelliteNetwork: 'Iridium',
    },
    recommendationTags: [
      'Bảo hộ cứu nạn',
      'SOS toàn cầu 24/7',
    ],
  },
  {
    id: 'prod_headlamp_1',
    sku: 'NH-HL-350',
    name: 'Đèn pin đội đầu Naturehike 350lm',
    category: safetyCategory,
    description:
      'Đèn đội đầu chống nước, sử dụng pin sạc Type-C và có chế độ ánh sáng đỏ dùng trong khu cắm trại.',
    dailyPrice: 35_000,
    depositPolicy: {
      type: 'FIXED',
      amount: 250_000,
      referenceValue: null,
      percentage: null,
    },
    currency: 'VND',
    status: 'ACTIVE',
    imageUrls: [
      'https://images.unsplash.com/photo-1517825738774-7de9363ef735?auto=format&fit=crop&w=1200&q=85',
    ],
    spec: {
      weightKg: 0.09,
      brightness: '350 lumen',
      batteryLife: '8–16 giờ',
      waterproof: true,
    },
    recommendationTags: [
      'Di chuyển ban đêm',
      'Pin sạc Type-C',
    ],
  },
];

export const rentalDemoStock: Record<
  string,
  number
> = {
  prod_tent_4: 5,
  prod_sleeping_bag_1: 2,
  prod_poles_1: 12,
  prod_gps_1: 3,
  prod_headlamp_1: 8,
};

export const rentalDemoRecommendations: RentalRecommendation[] =
  [
    {
      productId: 'prod_tent_4',
      reasons: [
        'Phù hợp hành trình 3 ngày 2 đêm',
        'Cản gió tốt ở khu vực cao trên 2.000m',
      ],
      source: 'RULE',
    },
    {
      productId: 'prod_sleeping_bag_1',
      reasons: [
        'Dự báo nhiệt độ ban đêm thấp',
        'Phù hợp lán nghỉ ở độ cao lớn',
      ],
      source: 'RULE',
    },
    {
      productId: 'prod_poles_1',
      reasons: [
        'Hỗ trợ cân bằng trên đường dốc',
        'Giảm áp lực đầu gối khi xuống núi',
      ],
      source: 'RULE',
    },
    {
      productId: 'prod_gps_1',
      reasons: [
        'Tuyến có đoạn mất sóng điện thoại',
        'Tăng khả năng liên lạc khi khẩn cấp',
      ],
      source: 'RULE',
    },
  ];

function createAbortError() {
  const error = new Error(
    'Yêu cầu đã bị huỷ.',
  );

  error.name = 'AbortError';

  return error;
}

export async function waitForRentalDemo(
  signal?: AbortSignal,
) {
  if (signal?.aborted) {
    throw createAbortError();
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 280);
  });

  if (signal?.aborted) {
    throw createAbortError();
  }
}

export async function getRentalCatalog(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalCatalogData> {
  await waitForRentalDemo(signal);

  const recommendationByProduct =
    new Map(
      rentalDemoRecommendations.map(
        (recommendation) => [
          recommendation.productId,
          recommendation,
        ],
      ),
    );

  return {
    eligibility: {
      bookingId,
      eligible: true,
      reason: null,
      trip: {
        id: 'trip_fansipan_3n2d',
        name: 'Chinh phục Đỉnh Fansipan 3N2Đ',
        startAt:
          '2026-11-18T06:00:00+07:00',
        endAt:
          '2026-11-20T17:00:00+07:00',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      rentalCutoffAt:
        '2026-11-17T18:00:00+07:00',
    },

    categories,

    items: rentalDemoProducts.map(
      (product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        dailyPrice: product.dailyPrice,
        depositAmount:
          product.depositPolicy.amount,
        currency: product.currency,
        imageUrl:
          product.imageUrls[0] ?? null,
        spec: product.spec,
        availableCount:
          rentalDemoStock[product.id] ?? 0,
        recommendation:
          recommendationByProduct.get(
            product.id,
          ) ?? null,
      }),
    ),
  };
}