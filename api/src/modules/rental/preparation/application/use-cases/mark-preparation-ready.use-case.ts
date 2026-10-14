import { Inject, Injectable } from '@nestjs/common';
import { WAREHOUSE_TASK_PORT, type MarkPreparationReadyCommand, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class MarkPreparationReadyUseCase {
  constructor(@Inject(WAREHOUSE_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(command: Omit<MarkPreparationReadyCommand, 'now'> & { now?: Date }) {
    return this.port.markReady({ ...command, now: command.now ?? new Date() });
  }
}
