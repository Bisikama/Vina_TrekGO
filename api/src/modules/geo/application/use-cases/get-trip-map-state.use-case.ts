import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { DeviationStatus } from '@prisma/client'

import {
  MapDeviationDisplayStatus,
  TripMapStateResponse,
} from '../../presentation/dtos/trip-map-state.dto'
import { TripMapStatePort } from '../ports/trip-map-state.port'

@Injectable()
export class GetTripMapStateUseCase {
  constructor(private readonly port: TripMapStatePort) {}

  async execute(tripId: string, userId: string, userRole: string): Promise<TripMapStateResponse> {
    const data = await this.port.getMapStateData(tripId, userId)

    // 1. Kiểm tra tồn tại chuyến đi
    if (!data.tripExists) {
      throw new NotFoundException('Chuyến đi không tồn tại')
    }

    // 2. Kiểm tra quyền truy cập (Người tham gia, Leader, Creator hoặc Admin)
    if (!data.hasAccess && userRole !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền truy cập vào dữ liệu hành trình của chuyến đi này')
    }

    // 3. Tính toán trạng thái lệch đường (Sử dụng Enum Prisma & DTO)
    // Nếu sự kiện gần nhất là DEVIATED và chưa recovered -> DEVIATED, ngược lại -> NORMAL
    const isDeviated =
      data.latestDeviation?.status === DeviationStatus.DEVIATED &&
      !data.latestDeviation.recoveredAt

    const deviationStatus: MapDeviationDisplayStatus = isDeviated
      ? MapDeviationDisplayStatus.DEVIATED
      : MapDeviationDisplayStatus.NORMAL

    // 4. Tính toán tiến độ Checkpoints
    const total = data.totalCheckpoints
    const passed = data.arrivedCheckpointIds.length
    const percentage = total > 0 ? Math.min(100, Math.round((passed / total) * 100)) : 0

    // 5. Trả về Response
    return {
      tripId,
      gpsSession: data.activeSession
        ? {
            id: data.activeSession.id,
            status: data.activeSession.status,
            startedAt: data.activeSession.startedAt.toISOString(),
            totalDistanceMeters: data.activeSession.totalDistanceMeters,
          }
        : null,
      lastLocation: data.lastLocation
        ? {
            latitude: data.lastLocation.latitude,
            longitude: data.lastLocation.longitude,
            accuracyM: data.lastLocation.accuracyM,
            speedMps: data.lastLocation.speedMps,
            headingDeg: data.lastLocation.headingDeg,
            altitudeM: data.lastLocation.altitudeM,
            recordedAt: data.lastLocation.recordedAt.toISOString(),
          }
        : null,
      deviation: {
        status: deviationStatus,
        maxDeviationDistanceM: data.latestDeviation?.maxDeviationDistanceM ?? null,
        lastCheckedAt: data.latestDeviation?.startAt.toISOString() ?? null,
      },
      progress: {
        totalCheckpoints: total,
        passedCheckpoints: passed,
        completedPercentage: percentage,
        arrivedCheckpointIds: data.arrivedCheckpointIds,
      },
    }
  }
}
