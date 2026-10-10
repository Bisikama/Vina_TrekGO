import { Inject, Injectable } from '@nestjs/common';
import {
  RENTAL_ORDER_PORT,
  type CreateRentalOrderResult,
  type RentalOrderPort,
} from '../ports/rental-order.port';

export interface CreateRentalOrderUseCaseCommand {
  userId: string;
  quoteId: string;
  idempotencyKey: string;
  now?: Date;
}

@Injectable()
export class CreateRentalOrderUseCase {
  constructor(
    @Inject(RENTAL_ORDER_PORT)
    private readonly rentalOrderPort: RentalOrderPort,
  ) {}

  execute(
    command: CreateRentalOrderUseCaseCommand,
  ): Promise<CreateRentalOrderResult> {
    return this.rentalOrderPort.createOrder({
      userId: command.userId,
      quoteId: command.quoteId,
      idempotencyKey: command.idempotencyKey,
      now: command.now ?? new Date(),
    });
  }
}
