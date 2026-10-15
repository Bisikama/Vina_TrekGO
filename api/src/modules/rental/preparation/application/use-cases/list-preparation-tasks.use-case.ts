import { Inject, Injectable } from '@nestjs/common';
import { WAREHOUSE_TASK_PORT, type ListPreparationTasksQuery, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class ListPreparationTasksUseCase {
  constructor(@Inject(WAREHOUSE_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(query: ListPreparationTasksQuery) {
    return this.port.listTasks(query);
  }
}
