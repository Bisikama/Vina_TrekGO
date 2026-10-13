import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_ORDER_PORT, type RentalOrderPort } from '../ports/rental-order.port';

@Injectable()
export class PreviewRentalCancellationUseCase {
  constructor(@Inject(RENTAL_ORDER_PORT) private readonly port: RentalOrderPort) {}

  execute(input: { userId: string; orderId: string; now?: Date }) {
    return this.port.previewCancellation({ ...input, now: input.now ?? new Date() });
  }
}
