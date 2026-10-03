import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  CheckpointPort,
  CheckpointSummary,
  UpdateCheckpointData,
} from '../ports/checkpoint.port'

@Injectable()
export class UpdateCheckpointUseCase {
  constructor(private readonly checkpointPort: CheckpointPort) {}

  async execute(id: string, dto: UpdateCheckpointData): Promise<CheckpointSummary> {
    const existing = await this.checkpointPort.findById(id)
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy điểm mốc với ID '${id}'`)
    }

    if (dto.destinationId && dto.destinationId !== existing.destinationId) {
      const destinationExists = await this.checkpointPort.checkDestinationExists(dto.destinationId)
      if (!destinationExists) {
        throw new NotFoundException(`Không tìm thấy địa danh với ID '${dto.destinationId}'`)
      }
    }

    if (dto.code && dto.code.trim().toUpperCase() !== (existing.code?.toUpperCase() ?? '')) {
      const conflict = await this.checkpointPort.findByCode(dto.code.trim())
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Mã điểm mốc '${dto.code.trim()}' đã tồn tại`)
      }
    }

    return this.checkpointPort.update(id, dto)
  }
}
