import { Inject, Injectable } from '@nestjs/common';
import { WAREHOUSE_TASK_PORT, type GetPreparationTaskQuery, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class GetPreparationTaskUseCase {
  constructor(@Inject(WAREHOUSE_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(query: GetPreparationTaskQuery) {
    return this.port.getTask(query);
  }
}
