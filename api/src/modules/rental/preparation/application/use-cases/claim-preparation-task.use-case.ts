import { Inject, Injectable } from '@nestjs/common';
import { WAREHOUSE_TASK_PORT, type ClaimPreparationTaskCommand, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class ClaimPreparationTaskUseCase {
  constructor(@Inject(WAREHOUSE_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(command: Omit<ClaimPreparationTaskCommand, 'now'> & { now?: Date }) {
    return this.port.claimTask({ ...command, now: command.now ?? new Date() });
  }
}
