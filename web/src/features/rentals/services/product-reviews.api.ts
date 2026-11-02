import { apiClient } from "@/lib/axios";

// GET /rental-products/:productId/reviews — API công khai, chỉ gồm đánh giá của người đã thực sự thuê.

type Envelope<T> = T | { data: T };
const unwrap = <T,>(payload: Envelope<T>) =>
  payload && typeof payload === "object" && "data" in payload ? (payload as { data: T }).data : (payload as T);

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

export async function listProductReviews(productId: string, options?: { page?: number; pageSize?: number; rating?: number }) {
  const response = await apiClient.get<Envelope<ProductReviewList>>(
    `/api/v1/rental-products/${encodeURIComponent(productId)}/reviews`,
    { params: { page: options?.page ?? 1, pageSize: options?.pageSize ?? 5, rating: options?.rating } },
  );
  return unwrap(response.data);
}
