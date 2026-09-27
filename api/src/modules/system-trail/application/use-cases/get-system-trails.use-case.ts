import { Inject, Injectable } from '@nestjs/common'
import { I_SYSTEM_TRAIL_REPOSITORY } from '../ports/system-trail.port'
import type { ISystemTrailRepository, SystemTrailSummary } from '../ports/system-trail.port'

@Injectable()
export class GetSystemTrailsUseCase {
  constructor(
    @Inject(I_SYSTEM_TRAIL_REPOSITORY)
    private readonly trailRepo: ISystemTrailRepository,
  ) {}

  async execute(destinationId?: string): Promise<SystemTrailSummary[]> {
    return this.trailRepo.findAll(destinationId)
  }
}
