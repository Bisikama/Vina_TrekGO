import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  CheckpointPort,
  CheckpointSummary,
  CreateCheckpointData,
} from '../ports/checkpoint.port'

@Injectable()
export class CreateCheckpointUseCase {
  constructor(private readonly checkpointPort: CheckpointPort) {}

  async execute(dto: CreateCheckpointData): Promise<CheckpointSummary> {
    const destinationExists = await this.checkpointPort.checkDestinationExists(dto.destinationId)
    if (!destinationExists) {
      throw new NotFoundException(`Không tìm thấy địa danh với ID '${dto.destinationId}'`)
    }

    if (dto.code && dto.code.trim()) {
      const existingCode = await this.checkpointPort.findByCode(dto.code.trim())
      if (existingCode) {
        throw new ConflictException(`Mã điểm mốc '${dto.code.trim()}' đã tồn tại trong hệ thống`)
      }
    }

    return this.checkpointPort.create(dto)
  }
}
