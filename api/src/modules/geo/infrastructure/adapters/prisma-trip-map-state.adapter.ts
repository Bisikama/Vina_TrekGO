import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { TripMapStatePort, TripMapStateRawData } from '../../application/ports/trip-map-state.port'

@Injectable()
export class PrismaTripMapStateAdapter implements TripMapStatePort {
  constructor(private readonly prisma: PrismaService) {}

  async getMapStateData(tripId: string, userId: string): Promise<TripMapStateRawData> {
    // 1. Kiểm tra Trip & Quyền truy cập
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        tripMembersViaTripId: {
          where: { userId, status: 'ACTIVE' },
        },
        bookingsViaTripId: {
          where: {
            userId,
            status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'] },
          },
        },
        tripCheckpointsViaTripId: {
          where: { isEnabled: true },
          select: { id: true },
        },
      },
    })

    if (!trip) {
      return {
        tripExists: false,
        hasAccess: false,
        activeSession: null,
        lastLocation: null,
        latestDeviation: null,
        totalCheckpoints: 0,
        arrivedCheckpointIds: [],
      }
    }

    const hasAccess =
      trip.creatorId === userId ||
      trip.leaderId === userId ||
      trip.tripMembersViaTripId.length > 0 ||
      trip.bookingsViaTripId.length > 0

    if (!hasAccess) {
      return {
        tripExists: true,
        hasAccess: false,
        activeSession: null,
        lastLocation: null,
        latestDeviation: null,
        totalCheckpoints: 0,
        arrivedCheckpointIds: [],
      }
    }

    // 2. Tìm GPS Session gần nhất của User trong Trip này (ưu tiên ACTIVE)
    const session = await this.prisma.gpsSession.findFirst({
      where: { tripId, userId },
      orderBy: { createdAt: 'desc' },
      include: {
        gpsLocationsViaSessionId: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
        routeDeviationEventsViaSessionId: {
          orderBy: { startAt: 'desc' },
          take: 1,
        },
      },
    })

    // 3. Lấy vị trí gần nhất (nếu có)
    const latestLocation = session?.gpsLocationsViaSessionId[0] ?? null
    const latestDeviation = session?.routeDeviationEventsViaSessionId[0] ?? null

    // 4. Lấy danh sách Checkpoint mà User đã đi qua trong chuyến đi này
    const arrivedEvents = await this.prisma.checkpointEvent.findMany({
      where: { tripId, userId },
      select: { tripCheckpointId: true },
    })

    return {
      tripExists: true,
      hasAccess: true,
      activeSession: session
        ? {
            id: session.id,
            status: session.status,
            startedAt: session.startedAt,
            totalDistanceMeters: session.totalDistanceMeters ? Number(session.totalDistanceMeters) : null,
          }
        : null,
      lastLocation: latestLocation
        ? {
            latitude: Number(latestLocation.latitude),
            longitude: Number(latestLocation.longitude),
            accuracyM: latestLocation.accuracyM ? Number(latestLocation.accuracyM) : null,
            speedMps: latestLocation.speedMps ? Number(latestLocation.speedMps) : null,
            headingDeg: latestLocation.headingDeg ? Number(latestLocation.headingDeg) : null,
            altitudeM: latestLocation.altitudeM ? Number(latestLocation.altitudeM) : null,
            recordedAt: latestLocation.recordedAt,
          }
        : null,
      latestDeviation: latestDeviation
        ? {
            status: latestDeviation.status,
            maxDeviationDistanceM: latestDeviation.maxDeviationDistanceM
              ? Number(latestDeviation.maxDeviationDistanceM)
              : null,
            recoveredAt: latestDeviation.recoveredAt,
            startAt: latestDeviation.startAt,
          }
        : null,
      totalCheckpoints: trip.tripCheckpointsViaTripId.length,
      arrivedCheckpointIds: arrivedEvents.map((e) => e.tripCheckpointId),
    }
  }
}
