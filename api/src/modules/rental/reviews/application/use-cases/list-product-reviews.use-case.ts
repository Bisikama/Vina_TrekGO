import { Inject, Injectable } from '@nestjs/common'
import {
  RENTAL_REVIEW_PORT,
  type ListProductReviewsQuery,
  type RentalReviewPort,
} from '../ports/rental-review.port'

@Injectable()
export class ListProductReviewsUseCase {
  constructor(@Inject(RENTAL_REVIEW_PORT) private readonly port: RentalReviewPort) {}

  execute(query: ListProductReviewsQuery) {
    return this.port.listProductReviews(query)
  }
}
