import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { DestinationPort, DestinationSummary, UpdateDestinationData } from '../ports/destination.port'

@Injectable()
export class UpdateDestinationUseCase {
  constructor(private readonly destinationPort: DestinationPort) {}

  async execute(id: string, dto: UpdateDestinationData): Promise<DestinationSummary> {
    const existing = await this.destinationPort.findById(id)
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy điểm đến với ID '${id}'`)
    }

    if (dto.name && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const conflict = await this.destinationPort.findByName(dto.name)
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Địa danh '${dto.name}' đã tồn tại`)
      }
    }

    return this.destinationPort.update(id, dto)
  }
}
