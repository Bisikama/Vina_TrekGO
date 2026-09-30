import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { TripStatus } from '@prisma/client'
import { NavigationContextPort } from '../port/navigation-context.port'
import { SwitchTrailDto, SwitchTrailResponse } from '../../presentation/dtos/switch-trail.dto'

@Injectable()
export class SwitchTrailUseCase {
  constructor(private readonly port: NavigationContextPort) {}

  async execute(
    tripId: string,
    userId: string,
    userRole: string,
    dto: SwitchTrailDto,
  ): Promise<SwitchTrailResponse> {
    // 1. Kiểm tra tồn tại chuyến đi
    const tripData = await this.port.getTripNavigationData(tripId, userId)
    if (!tripData) {
      throw new NotFoundException('Chuyến đi không tồn tại')
    }

    // 2. Kiểm tra quyền hạn: Chỉ Leader, Creator hoặc Admin mới được đổi
    const isLeaderOrCreator = tripData.leaderId === userId || tripData.creatorId === userId
    const isAdmin = userRole === 'ADMIN'

    if (!isLeaderOrCreator && !isAdmin) {
      throw new ForbiddenException('Chỉ Trưởng đoàn (Leader) mới có quyền đổi cung đường khi đang di chuyển')
    }

    // 3. Pre-condition RC-FR-103: Chuyến đi phải ở trạng thái OPEN hoặc IN_PROGRESS
    if (tripData.status !== TripStatus.IN_PROGRESS && tripData.status !== TripStatus.OPEN) {
      throw new BadRequestException(
        `Không thể đổi cung đường khi chuyến đi đang ở trạng thái ${tripData.status}. Chỉ cho phép khi chuyến đi đang OPEN hoặc IN_PROGRESS.`,
      )
    }

    // 4. Kiểm tra toPlanId không được trùng với cung đường đang active
    if (tripData.activeTrailPlanId === dto.toPlanId) {
      throw new BadRequestException('Lộ trình này hiện đang là lộ trình hoạt động của chuyến đi rồi')
    }

    // 5. Thực hiện đổi cung đường qua Port (với Prisma transaction & audit log)
    const result = await this.port.switchActiveTrail(tripId, dto.toPlanId, userId, dto.reason)

    // 6. Trả về contract chuẩn RC-FR-103: bảo toàn checkpoints
    const preservedCheckpointsCount = tripData.checkpoints.filter((c) => c.isRequired).length
    const changedAt = new Date().toISOString()

    return {
      event: 'ACTIVE_TRAIL_CHANGED',
      message: 'Chuyển đổi cung đường thành công, bảo toàn toàn bộ điểm kiểm soát bắt buộc',
      tripId,
      fromPlanId: result.previousPlanId,
      toPlanId: dto.toPlanId,
      changedAt,
      reason: dto.reason ?? null,
      preservedCheckpointsCount,
      activeTrail: {
        planId: result.newPlan.id,
        name: result.newPlan.snapshotName,
        difficulty: result.newPlan.snapshotDifficulty,
        distanceKm: result.newPlan.snapshotDistanceKm,
        elevationGainM: result.newPlan.snapshotElevationGainM,
        routeGeojson: result.newPlan.snapshotGeojson,
      },
    }
  }
}
