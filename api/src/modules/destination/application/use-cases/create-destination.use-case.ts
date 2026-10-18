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

    if (dto.pickupPoints && dto.pickupPoints.length > 0) {
      const codes = dto.pickupPoints
        .map((p) => p.code?.trim().toUpperCase())
        .filter((c): c is string => Boolean(c))
      const uniqueCodes = new Set(codes)
      if (uniqueCodes.size !== codes.length) {
        throw new ConflictException('Mã điểm tập kết (code) trong danh sách không được trùng lặp nhau')
      }
    }

    return this.destinationPort.create(dto)
  }
}
