import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type CreateAssessmentReviewCommand } from '../ports/rental-return.port';

@Injectable()
export class CreateAssessmentReviewUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: CreateAssessmentReviewCommand) { return this.port.createAssessmentReview(command); }
}
