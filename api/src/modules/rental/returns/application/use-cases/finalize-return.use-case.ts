import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type FinalizeReturnCommand } from '../ports/rental-return.port';

@Injectable()
export class FinalizeReturnUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: FinalizeReturnCommand) { return this.port.finalizeReturn(command); }
}
