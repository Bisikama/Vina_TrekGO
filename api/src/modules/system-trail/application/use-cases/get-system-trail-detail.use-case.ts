import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { I_SYSTEM_TRAIL_REPOSITORY } from '../ports/system-trail.port'
import type { ISystemTrailRepository, SystemTrailDetail } from '../ports/system-trail.port'

@Injectable()
export class GetSystemTrailDetailUseCase {
  constructor(
    @Inject(I_SYSTEM_TRAIL_REPOSITORY)
    private readonly trailRepo: ISystemTrailRepository,
  ) {}

  async execute(idOrCode: string): Promise<SystemTrailDetail> {
    const trail = await this.trailRepo.findByIdOrCode(idOrCode)
    if (!trail) {
      throw new NotFoundException(`Không tìm thấy cung đường với mã hoặc ID '${idOrCode}'`)
    }
    return trail
  }
}
