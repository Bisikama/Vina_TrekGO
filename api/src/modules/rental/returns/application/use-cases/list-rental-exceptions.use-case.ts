import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type ListExceptionsQuery } from '../ports/rental-return.port';

@Injectable()
export class ListRentalExceptionsUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: ListExceptionsQuery) { return this.port.listExceptions(command); }
}
