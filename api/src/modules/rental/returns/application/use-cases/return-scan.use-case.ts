import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type ReturnScanCommand } from '../ports/rental-return.port';

@Injectable()
export class ReturnScanUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: ReturnScanCommand) { return this.port.returnScan(command); }
}
