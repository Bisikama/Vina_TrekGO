import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type FinalInspectionCommand } from '../ports/rental-return.port';

@Injectable()
export class FinalInspectionUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: FinalInspectionCommand) { return this.port.finalInspection(command); }
}
