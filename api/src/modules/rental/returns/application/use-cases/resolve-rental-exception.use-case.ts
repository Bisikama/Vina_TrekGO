import { Inject, Injectable } from '@nestjs/common';
import { RENTAL_RETURN_PORT, type RentalReturnPort, type ResolveExceptionCommand } from '../ports/rental-return.port';

@Injectable()
export class ResolveRentalExceptionUseCase {
  constructor(@Inject(RENTAL_RETURN_PORT) private readonly port: RentalReturnPort) {}
  execute(command: ResolveExceptionCommand) { return this.port.resolveException(command); }
}
