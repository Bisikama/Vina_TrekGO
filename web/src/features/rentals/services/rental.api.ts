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

const categories: RentalCategory[] = [
  {
    id: "tent",
    name: "Lều cắm trại",
  },
  {
    id: "sleep",
    name: "Túi ngủ & Nệm",
  },
  {
    id: "trekking",
    name: "Gậy trekking",
  },
  {
    id: "backpack",
    name: "Balo dã ngoại",
  },
  {
    id: "electronic",
    name: "Thiết bị điện tử",
  },
  {
    id: "clothing",
    name: "Trang phục",
  },
];

const products: RentalProduct[] = [
  {
    id: "prod_tent_4",
    sku: "NH-CU2P-GRN",
    name: "Lều siêu nhẹ Cloud Up 2 Pro",
    category: categories[0],
    description:
      "Lều hai người siêu nhẹ, khung nhôm chắc chắn và lớp phủ chống mưa. Phù hợp cho các chuyến trekking từ 2 đến 4 ngày.",
    dailyPrice: 120000,
    depositPolicy: {
      type: "FIXED",
      amount: 1000000,
      referenceValue: null,
      percentage: null,
    },
    currency: "VND",
    status: "ACTIVE",
    imageUrls: [
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=1200&q=85",
    ],
    spec: {
      sức_chứa: "2 người",
      trọng_lượng: "1.7 kg",
      chống_nước: "PU 4000 mm",
      khung: "Nhôm 7001",
    },
    recommendationTags: [
      "mưa nhẹ",
      "trekking dài ngày",
    ],
  },
  {
    id: "prod_sleeping_bag_1",
    sku: "NH-SB-CWB2",
    name: "Túi ngủ lông vũ CWB200",
    category: categories[1],
    description:
      "Túi ngủ lông vũ gọn nhẹ, giữ ấm tốt trong điều kiện núi cao và dễ dàng nén gọn trong balo.",
    dailyPrice: 75000,
    depositPolicy: {
      type: "FIXED",
      amount: 600000,
      referenceValue: null,
      percentage: null,
    },
    currency: "VND",
    status: "ACTIVE",
    imageUrls: [
      "https://images.unsplash.com/photo-1504851149312-7a075b496cc7?auto=format&fit=crop&w=1200&q=85",
    ],
    spec: {
      nhiệt_độ_thoải_mái: "5°C",
      nhiệt_độ_giới_hạn: "0°C",
      trọng_lượng: "910 g",
      chất_liệu: "Lông vũ 90/10",
    },
    recommendationTags: [
      "núi cao",
      "thời tiết lạnh",
    ],
  },
  {
    id: "prod_poles_1",
    sku: "BD-POLE-CRB",
    name: "Gậy leo núi Trail Pro Shock",
    category: categories[2],
    description:
      "Gậy trekking có hệ thống giảm chấn, khóa chắc chắn và điều chỉnh chiều dài nhanh khi thay đổi địa hình.",
    dailyPrice: 50000,
    depositPolicy: {
      type: "FIXED",
      amount: 450000,
      referenceValue: null,
      percentage: null,
    },
    currency: "VND",
    status: "ACTIVE",
    imageUrls: [
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85",
    ],
    spec: {
      số_lượng: "1 cặp",
      chiều_dài: "65–140 cm",
      trọng_lượng: "490 g/cặp",
      tay_cầm: "EVA chống trượt",
    },
    recommendationTags: [
      "đường dốc",
      "địa hình đá",
    ],
  },
  {
    id: "prod_backpack_1",
    sku: "OSP-ATM-65",
    name: "Balo trợ lực Atmos AG 65L",
    category: categories[3],
    description:
      "Balo trợ lực dung tích lớn với hệ thống lưng thoáng khí, phù hợp cho hành trình nhiều ngày.",
    dailyPrice: 95000,
    depositPolicy: {
      type: "FIXED",
      amount: 1200000,
      referenceValue: null,
      percentage: null,
    },
    currency: "VND",
    status: "ACTIVE",
    imageUrls: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85",
    ],
    spec: {
      dung_tích: "65 L",
      tải_trọng_khuyến_nghị: "15–23 kg",
      trọng_lượng: "2.1 kg",
      áo_mưa: "Có",
    },
    recommendationTags: [
      "3 ngày 2 đêm",
      "mang nhiều vật dụng",
    ],
  },
  {
    id: "prod_headlamp_1",
    sku: "BD-HL-ST45",
    name: "Đèn pin đội đầu Storm 450",
    category: categories[4],
    description:
      "Đèn đội đầu chống nước với nhiều chế độ sáng, phù hợp di chuyển ban đêm và xử lý tình huống khẩn cấp.",
    dailyPrice: 40000,
    depositPolicy: {
      type: "FIXED",
      amount: 350000,
      referenceValue: null,
      percentage: null,
    },
    currency: "VND",
    status: "ACTIVE",
    imageUrls: [
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
    ],
    spec: {
      độ_sáng: "450 lumen",
      chống_nước: "IP67",
      thời_lượng_pin: "5–100 giờ",
      chế_độ_đỏ: "Có",
    },
    recommendationTags: [
      "đi đêm",
      "cắm trại",
    ],
  },
  {
    id: "prod_jacket_1",
    sku: "TNF-GTX-01",
    name: "Áo khoác chống nước Gore-Tex",
    category: categories[5],
    description:
      "Áo khoác chống mưa và cản gió, thiết kế thoáng khí cho hoạt động trekking trong thời tiết thay đổi.",
    dailyPrice: 85000,
    depositPolicy: {
      type: "FIXED",
      amount: 900000,
      referenceValue: null,
      percentage: null,
    },
    currency: "VND",
    status: "ACTIVE",
    imageUrls: [
  "https://www.mountain-equipment.com/cdn/shop/files/HamishFrost_2023_Makalu___Nanda_Devi_455_-_Square.jpg?height=1080&v=1746801076&width=1080",
],
    spec: {
      kích_cỡ: "M / L / XL",
      chống_nước: "28.000 mm",
      thoáng_khí: "RET < 6",
      mũ_trùm: "Có thể điều chỉnh",
    },
    recommendationTags: [
      "mưa",
      "gió mạnh",
    ],
  },
];

const availableCountByProduct: Record<string, number> = {
  prod_tent_4: 8,
  prod_sleeping_bag_1: 14,
  prod_poles_1: 20,
  prod_backpack_1: 6,
  prod_headlamp_1: 18,
  prod_jacket_1: 9,
};

const recommendations: RentalRecommendation[] = [
  {
    productId: "prod_tent_4",
    reasons: [
      "Phù hợp với hành trình Tà Năng – Phan Dũng 3 ngày 2 đêm.",
      "Khả năng chống mưa tốt trong điều kiện thời tiết dự kiến.",
    ],
    source: "RULE",
  },
  {
    productId: "prod_sleeping_bag_1",
    reasons: [
      "Nhiệt độ ban đêm dự kiến xuống thấp.",
      "Trọng lượng nhẹ, phù hợp hành trình dài.",
    ],
    source: "AI",
  },
  {
    productId: "prod_poles_1",
    reasons: [
      "Tuyến đường có nhiều đoạn dốc và đá trơn.",
    ],
    source: "RULE",
  },
  {
    productId: "prod_headlamp_1",
    reasons: [
      "Lịch trình có hoạt động trước bình minh.",
    ],
    source: "RULE",
  },
];

const tripSummary: RentalTripSummary = {
  tripId: "trip_001",
  name: "Tà Năng – Phan Dũng",
  durationDays: 3,
  difficulty: "Trung bình – Khó",
  weatherSummary:
    "Ban ngày 22–26°C, ban đêm 14–17°C, có khả năng mưa nhẹ.",
};

function createEligibility(
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

function createAvailability(
  productId: string,
  bookingId: string,
): RentalAvailability {
  return {
    bookingId,
    productId,
    availableCount:
      availableCountByProduct[productId] ?? 0,
    rentalWindow: {
      occupiedFrom: "2026-10-09T12:00:00Z",
      occupiedUntil: "2026-10-12T12:00:00Z",
    },
    checkedAt: new Date().toISOString(),
  };
}

function cloneProduct(
  product: RentalProduct,
): RentalProduct {
  return {
    ...product,
    category: { ...product.category },
    depositPolicy: { ...product.depositPolicy },
    imageUrls: [...product.imageUrls],
    spec: { ...product.spec },
    recommendationTags: [
      ...(product.recommendationTags ?? []),
    ],
  };
}

function createAbortError() {
  const error = new Error("Request was aborted.");
  error.name = "AbortError";
  return error;
}

function simulateRequest(
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, 250);

    function handleAbort() {
      clearTimeout(timer);
      reject(createAbortError());
    }

    signal?.addEventListener("abort", handleAbort, {
      once: true,
    });
  });
}

export async function getRentalCatalog(
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalCatalogData> {
  await simulateRequest(signal);

  return {
    eligibility: createEligibility(bookingId),
    categories: categories.map((category) => ({
      ...category,
    })),
    items: products.map((product) => ({
      ...cloneProduct(product),
      availableCount:
        availableCountByProduct[product.id] ?? 0,
      recommendation:
        recommendations.find(
          (item) => item.productId === product.id,
        ) ?? null,
    })),
  };
}

export async function getRentalProductDetail(
  productId: string,
  bookingId: string,
  signal?: AbortSignal,
): Promise<RentalProductDetailData> {
  await simulateRequest(signal);

  const product = products.find(
    (item) => item.id === productId,
  );

  if (!product) {
    throw new Error("Không tìm thấy sản phẩm thuê.");
  }

  return {
    product: cloneProduct(product),
    availability: createAvailability(
      productId,
      bookingId,
    ),
    recommendation:
      recommendations.find(
        (item) => item.productId === productId,
      ) ?? null,
    tripSummary: { ...tripSummary },
  };
}