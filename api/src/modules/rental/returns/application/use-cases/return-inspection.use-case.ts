import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type ReturnInspectionCommand } from '../ports/rental-return.port';

@Injectable()
export class ReturnInspectionUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: ReturnInspectionCommand) { return this.port.returnInspection(command); }
}
