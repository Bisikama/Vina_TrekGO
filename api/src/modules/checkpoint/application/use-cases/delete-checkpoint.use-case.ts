import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CheckpointPort } from '../ports/checkpoint.port'

@Injectable()
export class DeleteCheckpointUseCase {
  constructor(private readonly checkpointPort: CheckpointPort) {}

  async execute(id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.checkpointPort.findById(id)
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy điểm mốc với ID '${id}'`)
    }

    const related = await this.checkpointPort.countRelated(id)
    if (related.trails > 0 || related.trips > 0) {
      const reasons: string[] = []
      if (related.trails > 0) reasons.push(`${related.trails} cung đường trekking`)
      if (related.trips > 0) reasons.push(`${related.trips} chuyến đi (tour)`)

      throw new BadRequestException(
        `Không thể vô hiệu hóa điểm mốc vì đang có ${reasons.join(' và ')} liên kết. Vui lòng gỡ hoặc hoàn thành trước khi thực hiện.`,
      )
    }

    await this.checkpointPort.delete(id)
    return {
      success: true,
      message: `Đã vô hiệu hóa điểm mốc '${existing.name}' thành công`,
    }
  }
}
