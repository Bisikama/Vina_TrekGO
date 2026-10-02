import { ConflictException, Injectable } from '@nestjs/common'
import {
  CreateDestinationData,
  DestinationPort,
  DestinationSummary,
} from '../ports/destination.port'

@Injectable()
export class CreateDestinationUseCase {
  constructor(private readonly destinationPort: DestinationPort) {}

  async execute(dto: CreateDestinationData): Promise<DestinationSummary> {
    const existing = await this.destinationPort.findByName(dto.name)
    if (existing) {
      throw new ConflictException(`Địa danh '${dto.name}' đã tồn tại trong hệ thống`)
    }

    return this.destinationPort.create(dto)
  }
}
