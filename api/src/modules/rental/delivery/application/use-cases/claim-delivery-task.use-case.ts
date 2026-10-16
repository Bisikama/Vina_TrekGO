import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type ClaimDeliveryTaskCommand, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class ClaimDeliveryTaskUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(command: Omit<ClaimDeliveryTaskCommand, 'now'> & { now?: Date }) { return this.port.claimTask({ ...command, now: command.now ?? new Date() }); }
}
