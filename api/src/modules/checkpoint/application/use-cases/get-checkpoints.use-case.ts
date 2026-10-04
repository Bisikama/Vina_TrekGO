import { Injectable } from '@nestjs/common'
import {
  CheckpointPort,
  CheckpointSummary,
  GetCheckpointsFilter,
  PaginatedResult,
} from '../ports/checkpoint.port'

@Injectable()
export class GetCheckpointsUseCase {
  constructor(private readonly checkpointPort: CheckpointPort) {}

  async execute(filter?: GetCheckpointsFilter): Promise<PaginatedResult<CheckpointSummary>> {
    return this.checkpointPort.findAll(filter)
  }
}
