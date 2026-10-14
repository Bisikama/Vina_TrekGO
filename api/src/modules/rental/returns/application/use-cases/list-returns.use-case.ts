import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type ListReturnsQuery } from '../ports/rental-return.port';

@Injectable()
export class ListReturnsUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: ListReturnsQuery) { return this.port.listReturns(command); }
}
