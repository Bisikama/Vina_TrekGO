import { Inject, Injectable } from '@nestjs/common';
import { DELIVERY_PORT, type DeliveryPort, type MarkNoShowCommand } from '../ports/delivery.port';
@Injectable()
export class MarkRentalNoShowUseCase {
  constructor(@Inject(DELIVERY_PORT) private readonly port: DeliveryPort) {}
  execute(command: Omit<MarkNoShowCommand, 'now'> & { now?: Date }) { return this.port.markNoShow({ ...command, now: command.now ?? new Date() }); }
}
