import { Inject, Injectable } from '@nestjs/common';
import { PREPARATION_TASK_PORT, type GetPreparationTaskQuery, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class GetPreparationTaskUseCase {
  constructor(@Inject(PREPARATION_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(query: GetPreparationTaskQuery) {
    return this.port.getTask(query);
  }
}
