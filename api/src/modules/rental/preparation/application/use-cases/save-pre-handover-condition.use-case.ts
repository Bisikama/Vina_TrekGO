import { Inject, Injectable } from '@nestjs/common';
import { WAREHOUSE_TASK_PORT, type SavePreHandoverConditionCommand, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class SavePreHandoverConditionUseCase {
  constructor(@Inject(WAREHOUSE_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(command: Omit<SavePreHandoverConditionCommand, 'now'> & { now?: Date }) {
    return this.port.savePreHandoverCondition({ ...command, now: command.now ?? new Date() });
  }
}
