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

export const rentalReviewApi = {
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
