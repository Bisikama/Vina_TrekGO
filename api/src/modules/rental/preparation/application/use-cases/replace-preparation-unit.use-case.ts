import { Inject, Injectable } from '@nestjs/common';
import { PREPARATION_TASK_PORT, type ReplacePreparationUnitCommand, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class ReplacePreparationUnitUseCase {
  constructor(@Inject(PREPARATION_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(command: Omit<ReplacePreparationUnitCommand, 'now'> & { now?: Date }) {
    return this.port.replaceUnit({ ...command, now: command.now ?? new Date() });
  }
}
