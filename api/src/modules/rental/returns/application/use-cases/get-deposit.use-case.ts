import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type GetDepositQuery } from '../ports/rental-return.port';

@Injectable()
export class GetDepositUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: GetDepositQuery) { return this.port.getDeposit(command); }
}
