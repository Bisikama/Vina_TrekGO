import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type ReceiveReturnCommand } from '../ports/rental-return.port';

@Injectable()
export class ReceiveReturnUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: ReceiveReturnCommand) { return this.port.receiveReturn(command); }
}
