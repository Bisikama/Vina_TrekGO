import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type AssignRentalTaskCommand, type DeliveryPort } from '../ports/delivery.port';
@Injectable()
export class AssignRentalTaskUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(command: Omit<AssignRentalTaskCommand, 'now'> & { now?: Date }) { return this.port.assignTask({ ...command, now: command.now ?? new Date() }); }
}
