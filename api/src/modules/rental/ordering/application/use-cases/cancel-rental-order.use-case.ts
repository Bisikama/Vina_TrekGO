import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_ORDER_PORT, type RentalOrderPort } from '../ports/rental-order.port';

@Injectable()
export class CancelRentalOrderUseCase {
  constructor(@Inject(RENTAL_ORDER_PORT) private readonly port: RentalOrderPort) {}

  execute(input: { userId: string; orderId: string; reason: string; previewVersion: string; expectedVersion: number; now?: Date }) {
    return this.port.cancelOrder({ ...input, now: input.now ?? new Date() });
  }
}
