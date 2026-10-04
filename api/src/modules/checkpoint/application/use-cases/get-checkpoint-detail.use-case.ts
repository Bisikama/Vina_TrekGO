import { Injectable, NotFoundException } from '@nestjs/common'
import { CheckpointPort, CheckpointSummary } from '../ports/checkpoint.port'

@Injectable()
export class GetCheckpointDetailUseCase {
  constructor(private readonly checkpointPort: CheckpointPort) {}

  async execute(id: string): Promise<CheckpointSummary> {
    const checkpoint = await this.checkpointPort.findById(id)
    if (!checkpoint) {
      throw new NotFoundException(`Không tìm thấy điểm mốc với ID '${id}'`)
    }
    return checkpoint
  }
}
