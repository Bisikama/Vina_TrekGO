import { Inject, Injectable } from '@nestjs/common';
import { PREPARATION_TASK_PORT, type ListReplacementCandidatesQuery, type PreparationTaskPort } from '../ports/preparation-task.port';

@Injectable()
export class ListReplacementCandidatesUseCase {
  constructor(@Inject(PREPARATION_TASK_PORT) private readonly port: PreparationTaskPort) {}
  execute(query: ListReplacementCandidatesQuery) {
    return this.port.listReplacementCandidates(query);
  }
}
