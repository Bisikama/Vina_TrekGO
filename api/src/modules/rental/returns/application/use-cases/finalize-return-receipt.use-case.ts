import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type FinalizeReturnReceiptCommand } from '../ports/rental-return.port';

@Injectable()
export class FinalizeReturnReceiptUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}

  execute(command: FinalizeReturnReceiptCommand) {
    return this.port.finalizeReturnReceipt(command);
  }
}
