import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type CreateDepositSettlementCommand } from '../ports/rental-return.port';

@Injectable()
export class CreateDepositSettlementUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: CreateDepositSettlementCommand) { return this.port.createDepositSettlement(command); }
}
