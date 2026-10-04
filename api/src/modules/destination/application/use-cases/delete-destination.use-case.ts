import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DestinationPort } from '../ports/destination.port'

@Injectable()
export class DeleteDestinationUseCase {
  constructor(private readonly destinationPort: DestinationPort) {}

  async execute(id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.destinationPort.findById(id)
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy điểm đến với ID '${id}'`)
    }

    const related = await this.destinationPort.countRelated(id)
    if (related.trails > 0 || related.trips > 0) {
      const reasons: string[] = []
      if (related.trails > 0) reasons.push(`${related.trails} cung đường trekking`)
      if (related.trips > 0) reasons.push(`${related.trips} chuyến đi`)

      throw new BadRequestException(
        `Không thể vô hiệu hóa địa danh vì đang có ${reasons.join(' và ')} liên kết. Vui lòng gỡ hoặc hoàn thành trước khi thực hiện.`,
      )
    }

    await this.destinationPort.delete(id)
    return {
      success: true,
      message: `Đã vô hiệu hóa  địa danh '${existing.name}' thành công`,
    }
  }
}
