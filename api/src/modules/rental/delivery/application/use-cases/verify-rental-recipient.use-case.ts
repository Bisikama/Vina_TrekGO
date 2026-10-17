import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type DeliveryPort, type VerifyRecipientCommand } from '../ports/delivery.port';
@Injectable()
export class VerifyRentalRecipientUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(command: Omit<VerifyRecipientCommand, 'now'> & { now?: Date }) { return this.port.verifyRecipient({ ...command, now: command.now ?? new Date() }); }
}
