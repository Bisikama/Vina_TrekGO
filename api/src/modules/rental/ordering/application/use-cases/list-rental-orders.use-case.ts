import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_ORDER_PORT, type RentalOrderPort } from '../ports/rental-order.port';

@Injectable()
export class ListRentalOrdersUseCase {
  constructor(@Inject(RENTAL_ORDER_PORT) private readonly port: RentalOrderPort) {}

  execute(input: { userId: string; bookingId?: string; status?: string; page: number; pageSize: number }) {
    return this.port.listOrders(input);
  }
}
