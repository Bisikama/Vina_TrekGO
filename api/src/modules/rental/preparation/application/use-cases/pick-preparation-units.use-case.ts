import { Inject, Injectable } from '@nestjs/common';
import { PREPARATION_TASK_PORT, type PickPreparationUnitsCommand, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class PickPreparationUnitsUseCase {
  constructor(@Inject(PREPARATION_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(command: Omit<PickPreparationUnitsCommand, 'now'> & { now?: Date }) {
    return this.port.pickUnits({ ...command, now: command.now ?? new Date() });
  }
}
