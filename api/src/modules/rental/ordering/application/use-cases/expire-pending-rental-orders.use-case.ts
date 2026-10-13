import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_ORDER_PORT, type RentalOrderPort } from '../ports/rental-order.port';

@Injectable()
export class ExpirePendingRentalOrdersUseCase {
  constructor(@Inject(RENTAL_ORDER_PORT) private readonly port: RentalOrderPort) {}

  execute(now = new Date()) {
    return this.port.expirePendingOrders(now);
  }
}
