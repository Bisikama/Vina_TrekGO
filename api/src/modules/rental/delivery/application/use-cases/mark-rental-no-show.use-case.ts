import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type DeliveryPort, type MarkNoShowCommand } from '../ports/delivery.port';
@Injectable()
export class MarkRentalNoShowUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(command: Omit<MarkNoShowCommand, 'now'> & { now?: Date }) { return this.port.markNoShow({ ...command, now: command.now ?? new Date() }); }
}
