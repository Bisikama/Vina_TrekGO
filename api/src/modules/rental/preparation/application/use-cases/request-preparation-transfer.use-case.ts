import { Inject, Injectable } from '@nestjs/common';
import { PREPARATION_TASK_PORT, type RequestPreparationTransferCommand, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class RequestPreparationTransferUseCase {
  constructor(@Inject(PREPARATION_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(command: Omit<RequestPreparationTransferCommand, 'now'> & { now?: Date }) {
    return this.port.requestTransfer({ ...command, now: command.now ?? new Date() });
  }
}
