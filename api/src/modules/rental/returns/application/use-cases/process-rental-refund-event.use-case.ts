import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type RentalRefundEventCommand } from '../ports/rental-return.port';

@Injectable()
export class ProcessRentalRefundEventUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: RentalRefundEventCommand) { return this.port.processRefundEvent(command); }
}
