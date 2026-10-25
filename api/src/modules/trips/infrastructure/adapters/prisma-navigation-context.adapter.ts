import { Prisma } from '@prisma/client'
import {
  PUBLIC_PARTICIPATION_BOOKING_STATUSES,
  PUBLIC_PARTICIPATION_TRIP_STATUSES,
} from '../../../bookings/public-participation.policy'
import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../../../shared/services/prisma.service'
import {
  NavigationContextPort,
  SwitchTrailResult,
  TripNavigationData,
} from '../../application/port/navigation-context.port'

@Injectable()
export class PrismaNavigationContextAdapter implements NavigationContextPort {
  constructor(private readonly prisma: PrismaService) {}

  async getTripNavigationData(tripId: string, userId: string): Promise<TripNavigationData | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const trip = await tx.trip.findUnique({
          where: { id: tripId },
          include: {
            tripActiveTrailPlanViaTripId: true,
            tripTrailPlansViaTripId: {
              orderBy: { sequence: 'asc' },
            },
            tripCheckpointsViaTripId: {
              where: { isEnabled: true },
              orderBy: { sequence: 'asc' },
            },
            tripMembersViaTripId: {
              where: {
                userId: userId,
                status: 'ACTIVE',
              },
            },
            bookingsViaTripId: {
              where: {
                userId: userId,
                status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'] },
              },
            },
          },
        })

        if (!trip) return null

        const actor = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true } })
        const linked =
          trip.tripType === 'PUBLIC' &&
          PUBLIC_PARTICIPATION_TRIP_STATUSES.includes(trip.status) &&
          actor?.status === 'ACTIVE' &&
          ['USER', 'LEADER'].includes(actor.role)
            ? await tx.bookingParticipant.findFirst({
                where: {
                  userId,
                  status: 'ACTIVE',
                  booking: { tripId, status: { in: PUBLIC_PARTICIPATION_BOOKING_STATUSES } },
                },
                select: { id: true },
              })
            : null
        const isMemberOrBooked = trip.tripMembersViaTripId.length > 0 || trip.bookingsViaTripId.length > 0 || !!linked

        return {
          id: trip.id,
          title: trip.title,
          status: trip.status,
          creatorId: trip.creatorId,
          leaderId: trip.leaderId,
          isMemberOrBooked,
          accessSource: linked
            ? 'PUBLIC_PARTICIPANT'
            : trip.bookingsViaTripId.length
              ? 'BOOKING_BUYER'
              : trip.tripMembersViaTripId.length
                ? 'PRIVATE_MEMBER'
                : null,
          activeTrailPlanId: trip.tripActiveTrailPlanViaTripId?.trailPlanId ?? null,
          trailPlans: trip.tripTrailPlansViaTripId.map((t) => ({
            id: t.id,
            sequence: t.sequence,
            snapshotName: t.snapshotName,
            snapshotDifficulty: t.snapshotDifficulty,
            snapshotDistanceKm: t.snapshotDistanceKm ? Number(t.snapshotDistanceKm) : null,
            snapshotElevationGainM: t.snapshotElevationGainM,
            snapshotGeojson: t.snapshotGeojson,
          })),
          checkpoints: trip.tripCheckpointsViaTripId.map((c) => ({
            id: c.id,
            sequence: c.sequence,
            name: c.name,
            latitude: Number(c.latitude),
            longitude: Number(c.longitude),
            radiusMeters: c.radiusMeters,
            isRequired: c.isRequired,
            isEnabled: c.isEnabled,
            missionTitle: c.missionTitle,
            missionDescription: c.missionDescription,
            missionType: c.missionType,
            rewardPoints: c.rewardPoints,
          })),
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }

  async switchActiveTrail(
    tripId: string,
    toPlanId: string,
    userId: string,
    reason?: string,
  ): Promise<SwitchTrailResult> {
    const targetPlan = await this.prisma.tripTrailPlan.findFirst({
      where: { id: toPlanId, tripId },
    })

    if (!targetPlan) {
      throw new BadRequestException('Lộ trình dự phòng (toPlanId) không thuộc về chuyến đi này')
    }

    return this.prisma.$transaction(async (tx) => {
      const currentActive = await tx.tripActiveTrailPlan.findUnique({
        where: { tripId },
      })

      if (currentActive?.trailPlanId === toPlanId) {
        throw new BadRequestException('Lộ trình này hiện đang là lộ trình hoạt động rồi')
      }

      await tx.tripActiveTrailPlan.upsert({
        where: { tripId },
        update: {
          trailPlanId: toPlanId,
          changedBy: userId,
          changedAt: new Date(),
          version: { increment: 1 },
        },
        create: {
          tripId,
          trailPlanId: toPlanId,
          changedBy: userId,
          version: 1,
        },
      })

      await tx.tripTrailSwitch.create({
        data: {
          tripId,
          fromPlanId: currentActive?.trailPlanId ?? null,
          toPlanId,
          reason: reason ?? null,
          actorId: userId,
        },
      })

      return {
        previousPlanId: currentActive?.trailPlanId ?? null,
        newPlan: {
          id: targetPlan.id,
          snapshotName: targetPlan.snapshotName,
          snapshotDifficulty: targetPlan.snapshotDifficulty,
          snapshotDistanceKm: targetPlan.snapshotDistanceKm ? Number(targetPlan.snapshotDistanceKm) : null,
          snapshotElevationGainM: targetPlan.snapshotElevationGainM,
          snapshotGeojson: targetPlan.snapshotGeojson,
        },
      }
    })
  }
}
