import { Inject, Injectable } from '@nestjs/common';
import { PREPARATION_TASK_PORT, type ListPickCandidatesQuery, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class ListPickCandidatesUseCase {
  constructor(@Inject(PREPARATION_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(query: ListPickCandidatesQuery) {
    return this.port.listPickCandidates(query);
  }
}
