import { Inject, Injectable } from '@nestjs/common'
import {
  RENTAL_REVIEW_PORT,
  type OrderReviewableItemsQuery,
  type RentalReviewPort,
} from '../ports/rental-review.port'

@Injectable()
export class GetOrderReviewableUseCase {
  constructor(@Inject(RENTAL_REVIEW_PORT) private readonly port: RentalReviewPort) {}

  execute(query: OrderReviewableItemsQuery) {
    return this.port.getOrderReviewableItems(query)
  }
}
