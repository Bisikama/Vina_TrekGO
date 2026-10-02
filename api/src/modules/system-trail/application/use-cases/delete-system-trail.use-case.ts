import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { I_SYSTEM_TRAIL_REPOSITORY } from '../ports/system-trail.port'
import type { ISystemTrailRepository } from '../ports/system-trail.port'

@Injectable()
export class DeleteSystemTrailUseCase {
  constructor(
    @Inject(I_SYSTEM_TRAIL_REPOSITORY)
    private readonly trailRepo: ISystemTrailRepository,
  ) {}

  async execute(id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.trailRepo.findByIdOrCode(id)
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy cung đường với ID '${id}'`)
    }

    const related = await this.trailRepo.countRelated(id)
    if (related.accesses > 0 || related.trips > 0) {
      const reasons: string[] = []
      if (related.accesses > 0) reasons.push(`${related.accesses} người dùng đã mua bản đồ`)
      if (related.trips > 0) reasons.push(`${related.trips} chuyến đi (tour) liên kết`)

      throw new BadRequestException(
        `Không thể vô hiệu hóa cung đường vì đang có ${reasons.join(' và ')}. Vui lòng kiểm tra lại.`,
      )
    }

    await this.trailRepo.softDelete(id)
    return {
      success: true,
      message: `Đã vô hiệu hóa cung đường '${existing.name}' thành công`,
    }
  }
}
