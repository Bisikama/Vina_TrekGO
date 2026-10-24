import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { NavigationContextPort } from '../port/navigation-context.port'
import { NavigationContextResponse } from '../../presentation/dtos/navigation-context.dto'

@Injectable()
export class GetNavigationContextUseCase {
  constructor(private readonly port: NavigationContextPort) {}

  async execute(tripId: string, userId: string, userRole: string): Promise<NavigationContextResponse> {
    const data = await this.port.getTripNavigationData(tripId, userId)

    if (!data) {
      throw new NotFoundException('Chuyến đi không tồn tại')
    }

    // Kiểm tra quyền: Creator, Leader, Member hoặc Admin
    const isOwnerOrLeader = data.creatorId === userId || data.leaderId === userId
    const isAdmin = userRole === 'ADMIN'

    if (!isOwnerOrLeader && !data.isMemberOrBooked && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền truy cập vào dữ liệu hành trình của chuyến đi này')
    }

    // 1. Xác định Active Trail (Ưu tiên activeTrailPlanId, nếu chưa có thì lấy sequence nhỏ nhất)
    let activePlan = data.trailPlans.find((p) => p.id === data.activeTrailPlanId)
    if (!activePlan && data.trailPlans.length > 0) {
      activePlan = data.trailPlans[0]
    }

    // 2. Danh sách planned trails (tất cả các plan dự phòng)
    const plannedTrails = data.trailPlans.map((p) => ({
      planId: p.id,
      sequence: p.sequence,
      name: p.snapshotName,
      difficulty: p.snapshotDifficulty,
      distanceKm: p.snapshotDistanceKm,
      elevationGainM: p.snapshotElevationGainM,
    }))

    // 3. Danh sách Checkpoints
    const requiredCheckpoints = data.checkpoints.map((c) => ({
      id: c.id,
      sequence: c.sequence,
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
      radiusMeters: c.radiusMeters,
      isRequired: c.isRequired,
      mission: c.missionTitle
        ? {
            title: c.missionTitle,
            description: c.missionDescription,
            type: c.missionType,
            rewardPoints: c.rewardPoints,
          }
        : null,
    }))

    return {
      tripId: data.id,
      title: data.title,
      tripStatus: data.status,
      accessSource: isAdmin ? 'ADMIN' : isOwnerOrLeader ? 'TRIP_MANAGER' : data.accessSource ?? 'LEGACY_MEMBERSHIP',
      activeTrail: activePlan
        ? {
            planId: activePlan.id,
            name: activePlan.snapshotName,
            difficulty: activePlan.snapshotDifficulty,
            distanceKm: activePlan.snapshotDistanceKm,
            elevationGainM: activePlan.snapshotElevationGainM,
            routeGeojson: activePlan.snapshotGeojson,
          }
        : null,
      plannedTrails,
      requiredCheckpoints,
    }
  }
}
