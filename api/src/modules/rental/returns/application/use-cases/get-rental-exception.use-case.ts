import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type GetExceptionQuery } from '../ports/rental-return.port';

@Injectable()
export class GetRentalExceptionUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: GetExceptionQuery) { return this.port.getException(command); }
}
