import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type ReturnToInventoryLocationCommand } from '../ports/rental-return.port';

@Injectable()
export class ReturnToInventoryLocationUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: ReturnToInventoryLocationCommand) { return this.port.returnToInventoryLocation(command); }
}
