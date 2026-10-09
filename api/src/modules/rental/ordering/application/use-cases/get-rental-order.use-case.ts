import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_ORDER_PORT, type RentalOrderPort } from '../ports/rental-order.port';

@Injectable()
export class GetRentalOrderUseCase {
  constructor(@Inject(RENTAL_ORDER_PORT) private readonly port: RentalOrderPort) {}

  execute(input: { actorUserId: string; actorRole: string; orderId: string }) {
    return this.port.getOrder(input);
  }
}
