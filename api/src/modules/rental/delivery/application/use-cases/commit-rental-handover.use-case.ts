import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type CommitHandoverCommand, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class CommitRentalHandoverUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(command: Omit<CommitHandoverCommand, 'now'> & { now?: Date }) { return this.port.commitHandover({ ...command, now: command.now ?? new Date() }); }
}
