import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_ORDER_PORT, type RentalOrderPort } from '../ports/rental-order.port';

@Injectable()
export class CreateRentalPaymentUseCase {
  constructor(@Inject(RENTAL_ORDER_PORT) private readonly port: RentalOrderPort) {}

  execute(input: { userId: string; orderId: string; idempotencyKey: string; now?: Date }) {
    return this.port.createOrReusePayment({ ...input, now: input.now ?? new Date() });
  }
}
