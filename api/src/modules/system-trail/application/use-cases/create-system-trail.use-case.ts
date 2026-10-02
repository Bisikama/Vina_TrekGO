import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { I_SYSTEM_TRAIL_REPOSITORY } from '../ports/system-trail.port'
import type {
  ISystemTrailRepository,
  CreateSystemTrailData,
  SystemTrailDetail,
} from '../ports/system-trail.port'

@Injectable()
export class CreateSystemTrailUseCase {
  constructor(
    @Inject(I_SYSTEM_TRAIL_REPOSITORY)
    private readonly trailRepo: ISystemTrailRepository,
  ) {}

  async execute(dto: CreateSystemTrailData): Promise<SystemTrailDetail> {
    const isDestValid = await this.trailRepo.validateDestination(dto.destinationId)
    if (!isDestValid) {
      throw new NotFoundException(`Không tìm thấy điểm đến (Destination) hoặc điểm đến đang không hoạt động`)
    }

    const existingCode = await this.trailRepo.findByCode(dto.code)
    if (existingCode) {
      throw new ConflictException(`Mã cung đường '${dto.code}' đã tồn tại trong hệ thống`)
    }

    if (dto.checkpoints && dto.checkpoints.length > 0) {
      const sequences = dto.checkpoints.map((c) => c.sequence)
      if (new Set(sequences).size !== sequences.length) {
        throw new BadRequestException(`Thứ tự (sequence) của các checkpoint không được trùng lặp`)
      }

      const checkpointIds = dto.checkpoints.map((c) => c.checkpointId)
      const areCheckpointsValid = await this.trailRepo.validateCheckpoints(dto.destinationId, checkpointIds)
      if (!areCheckpointsValid) {
        throw new BadRequestException(`Một số checkpoint không hợp lệ hoặc không thuộc về điểm đến này`)
      }
    }

    return this.trailRepo.create(dto)
  }
}
