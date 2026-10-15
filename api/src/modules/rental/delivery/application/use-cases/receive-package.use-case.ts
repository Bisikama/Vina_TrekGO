import { Inject, Injectable } from '@nestjs/common';
import { LOGISTICS_PORT, type DeliveryPort, type ReceivePackageCommand } from '../ports/delivery.port';
@Injectable()
export class ReceivePackageUseCase {
  constructor(@Inject(LOGISTICS_PORT) private readonly port: DeliveryPort) {}
  execute(command: Omit<ReceivePackageCommand, 'now'> & { now?: Date }) { return this.port.receivePackage({ ...command, now: command.now ?? new Date() }); }
}
