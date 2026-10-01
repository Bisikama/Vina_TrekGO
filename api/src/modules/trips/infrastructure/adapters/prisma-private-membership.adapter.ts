import { Injectable } from '@nestjs/common'
import { Prisma, PrivateTripInvite, Trip, TripMember } from '@prisma/client'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B, COMMON_ERROR_CODES as C } from '../../../../shared/errors'
import { PrivateMembershipPort, MemberPage } from '../../application/private-membership.port'
import { assertMemberActor } from '../../application/use-cases/private-membership.use-case'

const fail = (code: string, reason?: string): never => {
  throw AppError.fromCode(code, reason ? { details: { reason } } : undefined)
}
const joinable = (trip: Trip, now: Date) => {
  if (trip.status !== 'OPEN' || trip.startAt <= now) fail(B.INVALID_STATE_TRANSITION)
}
const validInvite = (invite: PrivateTripInvite, trip: Trip, now: Date) => {
  if (invite.status === 'REVOKED' || invite.revokedAt) fail(B.INVITE_REVOKED)
  if (invite.status === 'EXPIRED' || invite.expiresAt <= now || invite.expiresAt >= trip.startAt) fail(B.INVITE_EXPIRED)
}
const memberView = (m: TripMember) => ({
  id: m.id,
  role: m.role,
  status: m.status,
  joinedAt: m.joinedAt,
  version: m.version,
})
@Injectable()
export class PrismaPrivateMembershipAdapter extends PrivateMembershipPort {
  constructor(private readonly db: PrismaService) {
    super()
  }
  private async transaction<T>(
    userId: string,
    target: { tripId: string } | { code: string },
    joining: boolean,
    work: (tx: Prisma.TransactionClient, trip: Trip, invite: PrivateTripInvite | null, now: Date) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`
            assertMemberActor(await tx.user.findUnique({ where: { id: userId } }), joining)
            const found =
              'code' in target ? await tx.privateTripInvite.findUnique({ where: { code: target.code } }) : null
            const tripId = 'tripId' in target ? target.tripId : found?.tripId
            if (!tripId) return fail(B.NOT_FOUND)
            await tx.$queryRaw`SELECT id FROM trips WHERE id=${tripId}::uuid FOR UPDATE`
            const trip = await tx.trip.findFirst({ where: { id: tripId, tripType: 'PRIVATE' } })
            if (!trip) return fail(B.NOT_FOUND)
            if (found) await tx.$queryRaw`SELECT id FROM private_trip_invites WHERE id=${found.id}::uuid FOR UPDATE`
            const invite = found ? await tx.privateTripInvite.findUniqueOrThrow({ where: { id: found.id } }) : null
            const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
            return work(tx, trip, invite, now)
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
        )
      } catch (e) {
        const retry =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2034' || (e.code === 'P2010' && ['40001', '40P01'].includes(String(e.meta?.code))))
        if (!retry) throw e
        if (attempt >= 2) fail(B.PRIVATE_TRIP_VERSION_CONFLICT)
      }
    }
  }
  private async viewer(tx: Prisma.TransactionClient, userId: string, trip: Trip) {
    const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId: trip.id, userId } } })
    if (trip.creatorId !== userId && member?.status !== 'ACTIVE') fail(C.FORBIDDEN)
    return member
  }
  preview(code: string) {
    return this.db.$transaction(
      async (tx) => {
        const invite = await tx.privateTripInvite.findUnique({ where: { code } })
        if (!invite) return fail(B.NOT_FOUND)
        const trip = await tx.trip.findFirst({
          where: { id: invite.tripId, tripType: 'PRIVATE' },
          include: { creator: { select: { fullName: true } } },
        })
        if (!trip) return fail(B.NOT_FOUND)
        const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
        validInvite(invite, trip, now)
        joinable(trip, now)
        const count = await tx.tripMember.count({ where: { tripId: trip.id, status: 'ACTIVE' } })
        const reason =
          count >= trip.maxPax
            ? B.CAPACITY_CONFLICT
            : invite.maxUses !== null && invite.usedCount >= invite.maxUses
              ? B.INVITE_USAGE_LIMIT_REACHED
              : null
        return {
          trip: {
            id: trip.id,
            tripType: trip.tripType,
            title: trip.title,
            startAt: trip.startAt,
            endAt: trip.endAt,
            status: trip.status,
            host: { displayName: trip.creator.fullName },
            activeMemberCount: count,
            capacity: trip.maxPax,
            remainingSlots: Math.max(0, trip.maxPax - count),
          },
          invite: { expiresAt: invite.expiresAt, status: 'ACTIVE' },
          joinable: !reason,
          joinDisabledReason: reason,
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }
  private async event(
    tx: Prisma.TransactionClient,
    actorId: string,
    trip: Trip,
    member: TripMember,
    previousStatus: string | null,
    eventType: string,
    now: Date,
  ) {
    await tx.bookingOutboxEvent.create({
      data: {
        deduplicationKey: `${eventType}:${member.id}:${member.version}`,
        eventType,
        aggregateType: 'PRIVATE_TRIP',
        aggregateId: trip.id,
        payload: {
          schemaVersion: 1,
          tripId: trip.id,
          tripType: 'PRIVATE',
          memberId: member.id,
          userId: member.userId,
          actorId,
          memberRole: member.role,
          previousStatus,
          status: member.status,
          memberVersion: member.version,
          tripVersion: trip.version,
          inviteId: member.joinedByInviteId,
          rejoined: eventType === 'PRIVATE_TRIP_MEMBER_JOINED' && previousStatus === 'LEFT',
          occurredAt: now.toISOString(),
        },
      },
    })
  }
  join(userId: string, code: string) {
    return this.transaction(userId, { code }, true, async (tx, trip, invite, now) => {
      if (!invite) return fail(B.NOT_FOUND)
      const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId: trip.id, userId } } })
      const count = await tx.tripMember.count({ where: { tripId: trip.id, status: 'ACTIVE' } })
      const result = (
        m: TripMember | null,
        t: Trip,
        alreadyMember: boolean,
        rejoined: boolean,
        activeMemberCount: number,
      ) => ({
        tripId: t.id,
        membership: m ? memberView(m) : null,
        alreadyMember,
        rejoined,
        isHost: t.creatorId === userId,
        activeMemberCount,
        capacity: t.maxPax,
        tripVersion: t.version,
        redirectTo: `/private-trips/${t.id}`,
      })
      // Creator access is independent from historical membership backfill.
      if (trip.creatorId === userId || member?.status === 'ACTIVE') return result(member, trip, true, false, count)
      if (member?.status === 'REMOVED') return fail(C.FORBIDDEN, 'MEMBER_REMOVED')
      if (member && member.status !== 'LEFT') return fail(B.INVALID_STATE_TRANSITION)
      joinable(trip, now)
      validInvite(invite, trip, now)
      const host = await tx.tripMember.findFirst({
        where: { tripId: trip.id, userId: trip.creatorId, role: 'HOST', status: 'ACTIVE' },
      })
      if (!host) fail(B.INVALID_STATE_TRANSITION, 'HOST_MEMBERSHIP_MISSING')
      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) fail(B.INVITE_USAGE_LIMIT_REACHED)
      if (count >= trip.maxPax) fail(B.CAPACITY_CONFLICT)
      const data = {
        status: 'ACTIVE' as const,
        role: 'MEMBER' as const,
        joinedAt: now,
        leftAt: null,
        joinedByInviteId: invite.id,
        pickupPointId: trip.pickupPointId,
        attendanceStatus: 'NOT_MARKED' as const,
        attendedAt: null,
        attendanceMarkedBy: null,
      }
      const next = member
        ? await tx.tripMember.update({ where: { id: member.id }, data: { ...data, version: { increment: 1 } } })
        : await tx.tripMember.create({ data: { ...data, tripId: trip.id, userId } })
      await tx.privateTripInvite.update({ where: { id: invite.id }, data: { usedCount: { increment: 1 } } })
      const nextTrip = await tx.trip.update({ where: { id: trip.id }, data: { version: { increment: 1 } } })
      await this.event(tx, userId, nextTrip, next, member?.status ?? null, 'PRIVATE_TRIP_MEMBER_JOINED', now)
      return result(next, nextTrip, false, !!member, count + 1)
    })
  }
  room(userId: string, tripId: string) {
    return this.transaction(userId, { tripId }, false, async (tx, trip, _invite, now) => {
      const member = await this.viewer(tx, userId, trip)
      const isHost = trip.creatorId === userId,
        editable = trip.status === 'OPEN' && trip.startAt > now
      const pickupPoint = trip.pickupPointId
        ? await tx.pickupPoint.findUnique({
            where: { id: trip.pickupPointId },
            select: { id: true, name: true, address: true, latitude: true, longitude: true },
          })
        : null
      const plannedRoutes = (await tx.tripTrailPlan.findMany({ where: { tripId }, orderBy: { sequence: 'asc' } })).map(
        (p) => ({
          id: p.id,
          sequence: p.sequence,
          sourceType: p.personalTrailId ? 'PERSONAL' : 'SYSTEM',
          name: p.snapshotName,
          difficulty: p.snapshotDifficulty,
          distanceKm: p.snapshotDistanceKm,
          elevationGainM: p.snapshotElevationGainM,
          geojson: p.snapshotGeojson,
        }),
      )
      const requiredCheckpoints = await tx.tripCheckpoint.findMany({
        where: { tripId, isRequired: true },
        orderBy: { sequence: 'asc' },
        select: {
          id: true,
          sequence: true,
          name: true,
          description: true,
          latitude: true,
          longitude: true,
          radiusMeters: true,
          isRequired: true,
          isEnabled: true,
        },
      })
      const activeMemberCount = await tx.tripMember.count({ where: { tripId, status: 'ACTIVE' } })
      return {
        trip: {
          id: trip.id,
          tripType: trip.tripType,
          title: trip.title,
          description: trip.description,
          status: trip.status,
          version: trip.version,
          startAt: trip.startAt,
          endAt: trip.endAt,
          capacity: trip.maxPax,
          activeMemberCount,
          pickupPoint,
        },
        viewer: {
          isHost,
          membershipId: member?.id ?? null,
          membershipVersion: member?.version ?? null,
          membershipStatus: member?.status ?? null,
        },
        permissions: {
          canInvite: isHost && editable,
          canRemoveMembers: isHost && editable,
          canLeave: !isHost && editable && member?.status === 'ACTIVE',
          canRent: false,
        },
        rental: { eligible: false, reason: 'PRIVATE_TRIP_RENTAL_DISABLED' },
        plannedRoutes,
        requiredCheckpoints,
      }
    })
  }
  members(userId: string, tripId: string, page: MemberPage) {
    return this.transaction(userId, { tripId }, false, async (tx, trip) => {
      await this.viewer(tx, userId, trip)
      if (trip.creatorId !== userId && page.status !== 'ACTIVE') fail(C.FORBIDDEN)
      const where = { tripId, ...(page.status === 'ALL' ? {} : { status: page.status }) }
      const rows = await tx.tripMember.findMany({
        where,
        include: { user: { select: { fullName: true } } },
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        take: page.pageSize,
        skip: (page.page - 1) * page.pageSize,
      })
      return {
        items: rows.map((m) => ({
          ...memberView(m),
          userId: m.userId,
          displayName: m.user.fullName,
          isHost: m.userId === trip.creatorId,
        })),
        page: page.page,
        pageSize: page.pageSize,
        total: await tx.tripMember.count({ where }),
        activeMemberCount: await tx.tripMember.count({ where: { tripId, status: 'ACTIVE' } }),
        capacity: trip.maxPax,
      }
    })
  }
  private change(userId: string, tripId: string, version: number, memberId?: string) {
    return this.transaction(userId, { tripId }, false, async (tx, trip, _invite, now) => {
      if (memberId && trip.creatorId !== userId) fail(C.FORBIDDEN)
      const old = memberId
        ? await tx.tripMember.findFirst({ where: { id: memberId, tripId } })
        : await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } })
      if (!old) return fail(B.NOT_FOUND)
      if (old.userId === trip.creatorId || old.role === 'HOST') fail(C.FORBIDDEN, 'HOST_MEMBERSHIP_IMMUTABLE')
      const status = memberId ? 'REMOVED' : 'LEFT'
      const result = (m: TripMember, t: Trip, changed: boolean) => ({
        tripId,
        membershipId: m.id,
        status: m.status,
        memberVersion: m.version,
        tripVersion: t.version,
        changed,
      })
      if (old.status === status) return result(old, trip, false)
      if (old.status === 'REMOVED') return fail(C.FORBIDDEN, 'MEMBER_REMOVED')
      if (old.version !== version) fail(B.MEMBERSHIP_VERSION_CONFLICT)
      joinable(trip, now)
      if (old.status !== 'ACTIVE' && !(memberId && old.status === 'LEFT')) fail(B.INVALID_STATE_TRANSITION)
      const next = await tx.tripMember.update({
        where: { id: old.id },
        data: { status, leftAt: now, version: { increment: 1 } },
      })
      const nextTrip = await tx.trip.update({ where: { id: trip.id }, data: { version: { increment: 1 } } })
      await this.event(
        tx,
        userId,
        nextTrip,
        next,
        old.status,
        memberId ? 'PRIVATE_TRIP_MEMBER_REMOVED' : 'PRIVATE_TRIP_MEMBER_LEFT',
        now,
      )
      return result(next, nextTrip, true)
    })
  }
  leave(userId: string, tripId: string, version: number) {
    return this.change(userId, tripId, version)
  }
  remove(userId: string, tripId: string, memberId: string, version: number) {
    return this.change(userId, tripId, version, memberId)
  }
}
