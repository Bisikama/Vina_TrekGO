import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type MarkUnitReadyCommand } from '../ports/rental-return.port';

@Injectable()
export class MarkReturnedUnitReadyUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: MarkUnitReadyCommand) { return this.port.markUnitReady(command); }
}
