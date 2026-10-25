import { Inject, Injectable } from '@nestjs/common'
import {
  RENTAL_REVIEW_PORT,
  type CreateRentalReviewCommand,
  type RentalReviewPort,
} from '../ports/rental-review.port'

@Injectable()
export class CreateRentalReviewUseCase {
  constructor(@Inject(RENTAL_REVIEW_PORT) private readonly port: RentalReviewPort) {}

  execute(command: CreateRentalReviewCommand) {
    return this.port.createReview(command)
  }
}
