import { Inject, Injectable } from '@nestjs/common';
import { WAREHOUSE_TASK_PORT, type PackPreparationPackageCommand, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class PackPreparationPackageUseCase {
  constructor(@Inject(WAREHOUSE_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(command: Omit<PackPreparationPackageCommand, 'now'> & { now?: Date }) {
    return this.port.packPackage({ ...command, now: command.now ?? new Date() });
  }
}
