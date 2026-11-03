import { syncPendingInvitations, transitionInvitation } from './private-invitation-transition'
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
    target: { tripId: string } | { code: string } | { invitationId: string },
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
            const direct =
              'invitationId' in target
                ? await tx.privateTripMemberInvitation.findFirst({
                    where: { id: target.invitationId, recipientUserId: userId },
                  })
                : null
            const tripId = 'tripId' in target ? target.tripId : (found?.tripId ?? direct?.tripId)
            if (!tripId) return fail(B.NOT_FOUND)
            await tx.$queryRaw`SELECT id FROM trips WHERE id=${tripId}::uuid FOR UPDATE`
            const trip = await tx.trip.findFirst({ where: { id: tripId, tripType: 'PRIVATE' } })
            if (!trip) return fail(B.NOT_FOUND)
            if (found) await tx.$queryRaw`SELECT id FROM private_trip_invites WHERE id=${found.id}::uuid FOR UPDATE`
            const invite = found ? await tx.privateTripInvite.findUniqueOrThrow({ where: { id: found.id } }) : null
            if (direct)
              await tx.$queryRaw`SELECT id FROM private_trip_member_invitations WHERE id=${direct.id}::uuid FOR UPDATE`
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
  listMine(userId: string, page: Pick<MemberPage, 'page' | 'pageSize'>) {
    return this.db.$transaction(
      async (tx) => {
        assertMemberActor(await tx.user.findUnique({ where: { id: userId } }))

        const where: Prisma.TripMemberWhereInput = {
          userId,
          status: 'ACTIVE',
          trip: { tripType: 'PRIVATE' },
        }
        const [members, total] = await Promise.all([
          tx.tripMember.findMany({
            where,
            include: { trip: true },
            orderBy: [{ trip: { startAt: 'asc' } }, { id: 'asc' }],
            take: page.pageSize,
            skip: (page.page - 1) * page.pageSize,
          }),
          tx.tripMember.count({ where }),
        ])
        const tripIds = members.map((member) => member.tripId)
        const groupedCounts = tripIds.length
          ? await tx.tripMember.groupBy({
              by: ['tripId'],
              where: { tripId: { in: tripIds }, status: 'ACTIVE' },
              _count: { _all: true },
            })
          : []
        const activeCounts = new Map(groupedCounts.map((row) => [row.tripId, row._count._all]))
        const now = new Date()

        return {
          items: members.map((member) => {
            const trip = member.trip
            const isHost = trip.creatorId === userId
            const editable = trip.status === 'OPEN' && trip.startAt > now
            const canRent =
              trip.startAt > now && ['OPEN', 'FULL', 'CLOSED'].includes(trip.status)

            return {
              ...trip,
              activeMemberCount: activeCounts.get(trip.id) ?? 0,
              viewer: {
                isHost,
                membershipId: member.id,
                membershipVersion: member.version,
                membershipStatus: member.status,
              },
              permissions: {
                canInvite: isHost && editable,
                canRemoveMembers: isHost && editable,
                canLeave: !isHost && editable,
                canRent,
              },
            }
          }),
          page: page.page,
          pageSize: page.pageSize,
          total,
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
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
  private async joinCore(
    tx: Prisma.TransactionClient,
    userId: string,
    trip: Trip,
    member: TripMember | null,
    count: number,
    now: Date,
    invite: PrivateTripInvite | null,
  ) {
    if (member?.status === 'REMOVED') return fail(C.FORBIDDEN, 'MEMBER_REMOVED')
    if (member && member.status !== 'LEFT') return fail(B.INVALID_STATE_TRANSITION)
    joinable(trip, now)
    if (invite) validInvite(invite, trip, now)
    const host = await tx.tripMember.findFirst({
      where: { tripId: trip.id, userId: trip.creatorId, role: 'HOST', status: 'ACTIVE' },
    })
    if (!host) fail(B.INVALID_STATE_TRANSITION, 'HOST_MEMBERSHIP_MISSING')
    if (invite && invite.maxUses !== null && invite.usedCount >= invite.maxUses) fail(B.INVITE_USAGE_LIMIT_REACHED)
    if (count >= trip.maxPax) fail(B.CAPACITY_CONFLICT)
    const data = {
      status: 'ACTIVE' as const,
      role: 'MEMBER' as const,
      joinedAt: now,
      leftAt: null,
      joinedByInviteId: invite?.id ?? null,
      pickupPointId: trip.pickupPointId,
      attendanceStatus: 'NOT_MARKED' as const,
      attendedAt: null,
      attendanceMarkedBy: null,
    }
    const next = member
      ? await tx.tripMember.update({ where: { id: member.id }, data: { ...data, version: { increment: 1 } } })
      : await tx.tripMember.create({ data: { ...data, tripId: trip.id, userId } })
    if (invite) await tx.privateTripInvite.update({ where: { id: invite.id }, data: { usedCount: { increment: 1 } } })
    const nextTrip = await tx.trip.update({ where: { id: trip.id }, data: { version: { increment: 1 } } })
    await this.event(tx, userId, nextTrip, next, member?.status ?? null, 'PRIVATE_TRIP_MEMBER_JOINED', now)

    return { next, nextTrip }
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
      if (trip.creatorId === userId || member?.status === 'ACTIVE') {
        await syncPendingInvitations(tx, trip.id, userId, now, { recipientUserId: userId, reason: 'ALREADY_MEMBER' })
        return result(member, trip, true, false, count)
      }
      const { next, nextTrip } = await this.joinCore(tx, userId, trip, member, count, now, invite)
      await syncPendingInvitations(tx, trip.id, userId, now, { recipientUserId: userId, reason: 'ALREADY_MEMBER' })
      return result(next, nextTrip, false, !!member, count + 1)
    })
  }
  async accept(userId: string, invitationId: string) {
    const outcome = await this.transaction(userId, { invitationId }, false, async (tx, trip, _link, now) => {
      const row = await tx.privateTripMemberInvitation.findUniqueOrThrow({ where: { id: invitationId } })
      const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId: trip.id, userId } } })
      const response = (
        invitation: typeof row,
        current: TripMember | null,
        alreadyMember: boolean,
        rejoined: boolean,
      ) => ({
        invitationStatus: invitation.status,
        resolutionReason: invitation.reason,
        tripId: trip.id,
        memberId: current?.id ?? null,
        membershipStatus: current?.status ?? null,
        membershipVersion: current?.version ?? null,
        membershipVersionAtAccept: invitation.membershipVersionAtAccept,
        canEnterRoom: trip.creatorId === userId || current?.status === 'ACTIVE',
        alreadyMember,
        rejoined,
      })
      if (row.status === 'ACCEPTED') return { body: response(row, member, member?.status === 'ACTIVE', false) }
      if (row.status === 'INVALIDATED' && row.reason === 'ALREADY_MEMBER' && member?.status === 'ACTIVE')
        return { body: response(row, member, member?.status === 'ACTIVE', false) }
      if (row.status === 'EXPIRED') return { error: B.INVITE_EXPIRED }
      if (row.status !== 'PENDING') return { error: B.INVITATION_NOT_ACTIONABLE, reason: row.reason ?? row.status }
      if (trip.status === 'CANCELLED') {
        await transitionInvitation(tx, row, userId, now, 'INVALIDATED', 'TRIP_CANCELLED')
        return { error: B.INVITATION_NOT_ACTIONABLE }
      }
      if (Math.min(+row.expiresAt, +trip.startAt - 1000) <= +now) {
        await transitionInvitation(tx, row, userId, now, 'EXPIRED', 'EXPIRED')
        return { error: B.INVITE_EXPIRED }
      }
      if (member?.status === 'ACTIVE') {
        const invalidated = await transitionInvitation(tx, row, userId, now, 'INVALIDATED', 'ALREADY_MEMBER')
        return { body: response(invalidated, member, true, false) }
      }
      if (member?.status === 'REMOVED') {
        await transitionInvitation(tx, row, userId, now, 'INVALIDATED', 'MEMBER_REMOVED')
        return { error: C.FORBIDDEN, reason: 'MEMBER_REMOVED' }
      }
      assertMemberActor(await tx.user.findUnique({ where: { id: userId } }), true)
      const count = await tx.tripMember.count({ where: { tripId: trip.id, status: 'ACTIVE' } })
      const { next } = await this.joinCore(tx, userId, trip, member, count, now, null)
      const accepted = await transitionInvitation(tx, row, userId, now, 'ACCEPTED', null, {
        acceptedMemberId: next.id,
        membershipVersionAtAccept: next.version,
        respondedAt: now,
      })
      return { body: response(accepted, next, false, member?.status === 'LEFT') }
    })
    if (outcome.error) fail(outcome.error, outcome.reason)
    return outcome.body
  }
  room(userId: string, tripId: string) {
    return this.transaction(userId, { tripId }, false, async (tx, trip, _invite, now) => {
      const member = await this.viewer(tx, userId, trip)
      const isHost = trip.creatorId === userId,
        editable = trip.status === 'OPEN' && trip.startAt > now
      // Membership permission only; Rental still validates its cutoff, policy and stock.
      const canRent =
        member?.status === 'ACTIVE' && trip.startAt > now && ['OPEN', 'FULL', 'CLOSED'].includes(trip.status)
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
          canRent,
        },
        rental: { eligible: canRent, reason: canRent ? null : 'TRIP_MEMBERSHIP_NOT_ELIGIBLE' },
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
      if (!memberId) {
        const rental = await tx.rentalOrder.findFirst({
          where: {
            tripId,
            OR: [{ userId: old.userId }, { membershipKind: 'PRIVATE_TRIP_MEMBER', membershipRef: old.id }],
            status: { notIn: ['CANCELLED', 'EXPIRED', 'COMPLETED'] },
          },
          select: { id: true },
        })
        if (rental) throw AppError.fromCode(B.RELATED_RENTALS_REQUIRE_RESOLUTION, {
          message: 'Vui lòng hủy đơn thuê hoặc hoàn tất trả thiết bị trước, sau đó quay lại rời chuyến.',
        })
      }
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
      if (memberId)
        await syncPendingInvitations(tx, tripId, userId, now, { recipientUserId: old.userId, reason: 'MEMBER_REMOVED' })
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
