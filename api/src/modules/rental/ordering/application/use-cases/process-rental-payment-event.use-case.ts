import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_ORDER_PORT, type RentalOrderPort, type RentalPaymentEventCommand } from '../ports/rental-order.port';

@Injectable()
export class ProcessRentalPaymentEventUseCase {
  constructor(@Inject(RENTAL_ORDER_PORT) private readonly port: RentalOrderPort) {}

  execute(input: RentalPaymentEventCommand) {
    return this.port.processPaymentEvent(input);
  }
}
