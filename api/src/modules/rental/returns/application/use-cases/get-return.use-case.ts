import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type GetReturnQuery } from '../ports/rental-return.port';

@Injectable()
export class GetReturnUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: GetReturnQuery) { return this.port.getReturn(command); }
}
