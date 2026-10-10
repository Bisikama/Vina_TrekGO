import { Inject, Injectable } from '@nestjs/common'
import { I_SYSTEM_TRAIL_REPOSITORY } from '../ports/system-trail.port'
import type {
  ISystemTrailRepository,
  SystemTrailSummary,
  GetSystemTrailsFilter,
  PaginatedResult,
} from '../ports/system-trail.port'

@Injectable()
export class GetSystemTrailsUseCase {
  constructor(
    @Inject(I_SYSTEM_TRAIL_REPOSITORY)
    private readonly trailRepo: ISystemTrailRepository,
  ) {}

  async execute(filter?: GetSystemTrailsFilter): Promise<PaginatedResult<SystemTrailSummary>> {
    return this.trailRepo.findAll(filter)
  }
}
