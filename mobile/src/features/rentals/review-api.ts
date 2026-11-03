import { apiRequest } from "@/lib/api-client";

export type CreateRentalProductReviewInput = {
  productId: string;
  rating: number;
  comment?: string;
};

export type RentalProductReview = CreateRentalProductReviewInput & {
  id: string;
  rentalOrderId: string;
  userId: string;
  createdAt: string;
};

type Envelope<T> = T | { data: T };

function unwrap<T>(payload: Envelope<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as { data?: T }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export type ReviewIneligibleReason =
  | "ALREADY_REVIEWED"
  | "ORDER_NOT_ELIGIBLE_FOR_REVIEW"
  | "DEPOSIT_NOT_SETTLED"
  | "PRODUCT_NOT_HANDED_OVER";

/** Một dòng của GET /rental-orders/:id/reviewable-items — backend là nguồn quyết định ai được đánh giá món nào. */
export type ReviewableItem = {
  productId: string;
  product: { id: string; sku?: string; name: string; images?: unknown };
  quantity: number;
  hasBeenHandedOver: boolean;
  isReviewed: boolean;
  reviewId: string | null;
  rating: number | null;
  canReview: boolean;
  ineligibleReason: ReviewIneligibleReason | string | null;
};

export type ProductReviewList = {
  summary: {
    averageRating: number | null;
    totalReviews: number;
    ratingBreakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  };
  reviews: {
    id: string;
    userName: string;
    rating: number;
    comment: string | null;
    verifiedUsage: true;
    createdAt: string;
  }[];
  pagination: { page: number; pageSize: number; totalPages: number; totalItems: number };
};

export const REVIEW_INELIGIBLE_LABELS: Record<string, string> = {
  ALREADY_REVIEWED: "Bạn đã đánh giá sản phẩm này.",
  ORDER_NOT_ELIGIBLE_FOR_REVIEW: "Chỉ đánh giá sau khi đơn hoàn tất trả đồ.",
  DEPOSIT_NOT_SETTLED: "Chỉ đánh giá sau khi quyết toán tiền cọc xong.",
  PRODUCT_NOT_HANDED_OVER: "Sản phẩm này chưa được bàn giao cho bạn.",
};

export const rentalReviewApi = {
  async getReviewableItems(orderId: string, accessToken: string) {
    const response = await apiRequest<Envelope<{ items: ReviewableItem[] }>>(
      `/api/v1/rental-orders/${encodeURIComponent(orderId)}/reviewable-items`,
      { method: "GET", accessToken },
    );
    return unwrap(response);
  },

  /** API công khai: điểm trung bình, phân bố sao và các nhận xét đã xác minh. */
  async listProductReviews(productId: string, options?: { page?: number; pageSize?: number }) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 5;
    const response = await apiRequest<Envelope<ProductReviewList>>(
      `/api/v1/rental-products/${encodeURIComponent(productId)}/reviews?page=${page}&pageSize=${pageSize}`,
      { method: "GET" },
    );
    return unwrap(response);
  },

  /** Gửi đánh giá một món. Cùng key + cùng nội dung thì retry an toàn; đổi nội dung thì dùng key mới. */
  async createOne(orderId: string, review: CreateRentalProductReviewInput, idempotencyKey: string, accessToken: string) {
    const response = await apiRequest<Envelope<RentalProductReview>>(
      `/api/v1/rental-orders/${encodeURIComponent(orderId)}/reviews`,
      {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(review),
      },
    );
    return unwrap(response);
  },

  async createMany(
    orderId: string,
    reviews: CreateRentalProductReviewInput[],
    accessToken: string,
  ) {
    const items = await Promise.all(
      reviews.map(async (review) => {
        const response = await apiRequest<Envelope<RentalProductReview>>(
          `/api/v1/rental-orders/${encodeURIComponent(orderId)}/reviews`,
          {
            method: "POST",
            accessToken,
            headers: {
              "Idempotency-Key": `rental-review:${orderId}:${review.productId}`,
            },
            body: JSON.stringify(review),
          },
        );

        return unwrap(response);
      }),
    );

    return { items };
  },
};
