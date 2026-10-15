import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type GetAssessmentQuery } from '../ports/rental-return.port';

@Injectable()
export class GetRentalAssessmentUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: GetAssessmentQuery) { return this.port.getAssessment(command); }
}
