import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { I_SYSTEM_TRAIL_REPOSITORY } from '../ports/system-trail.port'
import type {
  ISystemTrailRepository,
  UpdateSystemTrailData,
  SystemTrailDetail,
} from '../ports/system-trail.port'

@Injectable()
export class UpdateSystemTrailUseCase {
  constructor(
    @Inject(I_SYSTEM_TRAIL_REPOSITORY)
    private readonly trailRepo: ISystemTrailRepository,
  ) {}

  async execute(id: string, dto: UpdateSystemTrailData): Promise<SystemTrailDetail> {
    const existing = await this.trailRepo.findByIdOrCode(id)
    if (!existing) {
      throw new NotFoundException(`Không tìm thấy cung đường với ID '${id}'`)
    }

    const targetDestinationId = dto.destinationId ?? existing.destination.id

    if (dto.destinationId && dto.destinationId !== existing.destination.id) {
      const isDestValid = await this.trailRepo.validateDestination(dto.destinationId)
      if (!isDestValid) {
        throw new NotFoundException(`Điểm đến mới không tồn tại hoặc không hoạt động`)
      }
    }

    if (dto.code && dto.code.trim().toUpperCase() !== existing.code.toUpperCase()) {
      const conflict = await this.trailRepo.findByCode(dto.code)
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Mã cung đường '${dto.code}' đã tồn tại`)
      }
    }

    if (dto.checkpoints && dto.checkpoints.length > 0) {
      const sequences = dto.checkpoints.map((c) => c.sequence)
      if (new Set(sequences).size !== sequences.length) {
        throw new BadRequestException(`Thứ tự (sequence) của các checkpoint không được trùng lặp`)
      }

      const checkpointIds = dto.checkpoints.map((c) => c.checkpointId)
      const areCheckpointsValid = await this.trailRepo.validateCheckpoints(targetDestinationId, checkpointIds)
      if (!areCheckpointsValid) {
        throw new BadRequestException(`Một số checkpoint không hợp lệ hoặc không thuộc về điểm đến của cung đường`)
      }
    }

    return this.trailRepo.update(id, dto)
  }
}
