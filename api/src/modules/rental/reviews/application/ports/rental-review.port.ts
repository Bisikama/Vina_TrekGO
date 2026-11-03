export const RENTAL_REVIEW_PORT = Symbol('RENTAL_REVIEW_PORT')

export interface CreateRentalReviewCommand {
  orderId: string
  userId: string
  productId: string
  rating: number
  comment: string | null
  idempotencyKey: string
}

export interface RentalReviewResult {
  id: string
  rentalOrderId: string
  productId: string
  rating: number
  comment: string | null
  verifiedUsage: true
  createdAt: string
}

export interface ListProductReviewsQuery {
  productId: string
  page: number
  pageSize: number
  rating?: number
}

export interface ProductReviewListResult {
  summary: {
    averageRating: number | null
    totalReviews: number
    ratingBreakdown: Record<'1' | '2' | '3' | '4' | '5', number>
  }
  reviews: Array<{
    id: string
    userName: string
    rating: number
    comment: string | null
    verifiedUsage: true
    createdAt: string
  }>
  pagination: {
    page: number
    pageSize: number
    totalPages: number
    totalItems: number
  }
}

export interface OrderReviewableItemsQuery {
  orderId: string
  userId: string
}

export type ReviewIneligibleReason =
  | 'ALREADY_REVIEWED'
  | 'ORDER_NOT_ELIGIBLE_FOR_REVIEW'
  | 'DEPOSIT_NOT_SETTLED'
  | 'PRODUCT_NOT_HANDED_OVER'

export interface OrderReviewableItemsResult {
  items: Array<{
    productId: string
    product: {
      id: string
      sku: string
      name: string
      images: unknown
    }
    quantity: number
    hasBeenHandedOver: boolean
    isReviewed: boolean
    reviewId: string | null
    rating: number | null
    canReview: boolean
    ineligibleReason: ReviewIneligibleReason | null
  }>
}

export interface RentalReviewPort {
  createReview(command: CreateRentalReviewCommand): Promise<RentalReviewResult>
  listProductReviews(query: ListProductReviewsQuery): Promise<ProductReviewListResult>
  getOrderReviewableItems(query: OrderReviewableItemsQuery): Promise<OrderReviewableItemsResult>
}
