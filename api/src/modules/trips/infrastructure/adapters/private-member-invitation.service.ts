import { recordInvitation, transitionInvitation } from './private-invitation-transition'
import { Injectable } from '@nestjs/common'
import { InvitationStatus, Prisma, PrivateTripMemberInvitation, Trip, User } from '@prisma/client'
import { PrismaService } from '../../../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B } from '../../../../shared/errors'
import { databaseTime } from '../../../bookings/booking-capacity'
import { assertPrivateActor } from '../../application/use-cases/private-trip.use-case'
import { privateInvitationExpiry } from '../../application/private-invitation.policy'
import { CreatePrivateMemberInvitation } from '../../presentation/dtos/private-member-invitation.dto'
import { PrivateInvitationRequestService } from './private-invitation-request.service'
import { PrivateMembershipPort } from '../../application/private-membership.port'

export type InvitationPage = { page: number; pageSize: number; status?: InvitationStatus }
const fail = (code: string): never => {
  throw AppError.fromCode(code)
}

@Injectable()
export class PrivateMemberInvitationService {
  constructor(
    private readonly db: PrismaService,
    private readonly requests: PrivateInvitationRequestService,
    private readonly memberships: PrivateMembershipPort,
  ) {}

  async accept(userId: string, id: string) {
    await this.actor(this.db, userId)
    await this.requests.consumeRate(userId, 'mutation')
    return this.memberships.accept(userId, id)
  }

  private async actor(tx: Prisma.TransactionClient, userId: string, lock = false) {
    if (lock) await tx.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`
    assertPrivateActor(await tx.user.findUnique({ where: { id: userId } }), true)
  }
  private async host(tx: Prisma.TransactionClient, userId: string, tripId: string) {
    const trip = await tx.trip.findFirst({ where: { id: tripId, tripType: 'PRIVATE', creatorId: userId } })
    if (!trip || !(await tx.tripMember.findFirst({ where: { tripId, userId, role: 'HOST', status: 'ACTIVE' } })))
      return fail(B.NOT_FOUND)
    return trip
  }
  private view(row: PrivateTripMemberInvitation) {
    return {
      id: row.id,
      tripId: row.tripId,
      status: row.status,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      reason: row.reason,
      version: row.version,
      reservesCapacity: false,
    }
  }
  private effective(row: PrivateTripMemberInvitation, trip: Trip, now: Date) {
    if (row.status !== 'PENDING') return { status: row.status, reason: row.reason }
    if (trip.status === 'CANCELLED') return { status: 'INVALIDATED' as const, reason: 'TRIP_CANCELLED' }
    if (Math.min(+row.expiresAt, +trip.startAt - 1000) <= +now) return { status: 'EXPIRED' as const, reason: 'EXPIRED' }
    return { status: row.status, reason: row.reason }
  }
  async create(userId: string, tripId: string, key: string, input: CreatePrivateMemberInvitation) {
    await this.actor(this.db, userId)
    await this.host(this.db, userId, tripId)
    return this.requests.create(userId, tripId, key, input, async (tx) => {
      await this.actor(tx, userId, true)
      await tx.$queryRaw`SELECT id FROM trips WHERE id=${tripId}::uuid FOR UPDATE`
      const trip = await this.host(tx, userId, tripId)
      const now = await databaseTime(tx)
      if (trip.status !== 'OPEN' || trip.startAt <= now) return fail(B.INVALID_STATE_TRANSITION)
      const expiresAt = privateInvitationExpiry(now, trip.startAt, input.expiresAt)
      // Match all normalized candidates before checking eligibility; never choose an ambiguous account.
      const candidates = await tx.$queryRaw<Pick<User, 'id' | 'role' | 'status' | 'fullName'>[]>`
        SELECT id, role, status, full_name AS "fullName" FROM users
        WHERE lower(btrim(email))=${input.recipientEmail} LIMIT 2`
      const recipient = candidates[0]
      if (
        candidates.length !== 1 ||
        recipient.id === userId ||
        recipient.role !== 'USER' ||
        recipient.status !== 'ACTIVE'
      )
        return fail(B.INVITATION_RECIPIENT_UNAVAILABLE)
      const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId: recipient.id } } })
      if (member && member.status !== 'LEFT') return fail(B.INVITATION_RECIPIENT_UNAVAILABLE)
      const pending = await tx.privateTripMemberInvitation.findFirst({
        where: { tripId, recipientUserId: recipient.id, status: 'PENDING' },
      })
      if (pending) {
        await tx.$queryRaw`SELECT id FROM private_trip_member_invitations WHERE id=${pending.id}::uuid FOR UPDATE`
        const state = this.effective(pending, trip, now)
        if (state.status === 'PENDING') return fail(B.PENDING_INVITATION_EXISTS)
        await transitionInvitation(tx, pending, userId, now, state.status, state.reason)
      }
      const row = await tx.privateTripMemberInvitation.create({
        data: {
          tripId,
          senderUserId: userId,
          recipientUserId: recipient.id,
          recipientEmailSnapshot: input.recipientEmail,
          expiresAt,
        },
      })
      await recordInvitation(tx, row, userId, null)
      return { ...this.view(row), recipientDisplay: recipient.fullName }
    })
  }
  async change(userId: string, id: string, action: 'DECLINED' | 'REVOKED', reason?: string) {
    await this.actor(this.db, userId)
    await this.requests.consumeRate(userId, 'mutation')
    const outcome = await this.db.$transaction(
      async (tx) => {
        await this.actor(tx, userId, true)
        const scope = action === 'DECLINED' ? { recipientUserId: userId } : { senderUserId: userId }
        const found = await tx.privateTripMemberInvitation.findFirst({ where: { id, ...scope } })
        if (!found) return fail(B.NOT_FOUND)
        await tx.$queryRaw`SELECT id FROM trips WHERE id=${found.tripId}::uuid FOR UPDATE`
        const trip =
          action === 'REVOKED'
            ? await this.host(tx, userId, found.tripId)
            : await tx.trip.findUniqueOrThrow({ where: { id: found.tripId } })
        await tx.$queryRaw`SELECT id FROM private_trip_member_invitations WHERE id=${id}::uuid FOR UPDATE`
        const row = await tx.privateTripMemberInvitation.findUniqueOrThrow({ where: { id } })
        const now = await databaseTime(tx)
        if (row.status === action) return { body: this.view(row) }
        if (row.status === 'ACCEPTED') return { error: B.INVALID_STATE_TRANSITION }
        const state = this.effective(row, trip, now)
        if (state.status !== row.status) await transitionInvitation(tx, row, userId, now, state.status, state.reason)
        if (state.status === 'EXPIRED') return { error: B.INVITE_EXPIRED }
        if (state.status !== 'PENDING') return { error: B.INVITATION_NOT_ACTIONABLE }
        return { body: this.view(await transitionInvitation(tx, row, userId, now, action, reason ?? null)) }
      },
      { timeout: 15000 },
    )
    // Terminal updates must commit even when the API reports an error.
    if (outcome.error) fail(outcome.error)
    return outcome.body
  }
  async list(userId: string, page: InvitationPage, tripId?: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.actor(tx, userId)
        if (tripId) await this.host(tx, userId, tripId)
        const now = await databaseTime(tx)
        // Filter by effective status in SQL, including expiry at the current trip start.
        const scope = tripId ? Prisma.sql`i.trip_id=${tripId}::uuid` : Prisma.sql`i.recipient_user_id=${userId}::uuid`
        const effective = Prisma.sql`CASE WHEN i.status <> 'PENDING' THEN i.status::text WHEN t.status='CANCELLED' THEN 'INVALIDATED' WHEN LEAST(i.expires_at,t.start_at - interval '1 second') <= ${now} THEN 'EXPIRED' ELSE 'PENDING' END`
        const filter = page.status ? Prisma.sql`AND (${effective})=${page.status}` : Prisma.empty
        const counts = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT count(*) AS total FROM private_trip_member_invitations i JOIN trips t ON t.id=i.trip_id WHERE ${scope} ${filter}`,
        )
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT i.id FROM private_trip_member_invitations i JOIN trips t ON t.id=i.trip_id WHERE ${scope} ${filter} ORDER BY i.created_at DESC,i.id DESC LIMIT ${page.pageSize} OFFSET ${(page.page - 1) * page.pageSize}`,
        )
        const rows = await tx.privateTripMemberInvitation.findMany({
          where: { id: { in: ids.map((r) => r.id) } },
          include: { trip: true, recipient: { select: { fullName: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
        const total = Number(counts[0].total)
        return {
          items: rows.map((row) => ({
            ...this.view(row),
            ...this.effective(row, row.trip, now),
            expiresAt: new Date(Math.min(+row.expiresAt, +row.trip.startAt - 1000)).toISOString(),
            recipientDisplay: row.recipient.fullName,
          })),
          page: page.page,
          pageSize: page.pageSize,
          total,
          totalPages: Math.ceil(total / page.pageSize),
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }
  async preview(userId: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.actor(tx, userId)
        const row = await tx.privateTripMemberInvitation.findFirst({
          where: { id, OR: [{ recipientUserId: userId }, { senderUserId: userId }] },
          include: { trip: true, sender: { select: { fullName: true } }, recipient: { select: { fullName: true } } },
        })
        if (!row) return fail(B.NOT_FOUND)
        if (row.senderUserId === userId) await this.host(tx, userId, row.tripId)
        const now = await databaseTime(tx)
        const state = this.effective(row, row.trip, now)
        const member = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId: row.tripId, userId } } })
        const actor = await tx.user.findUniqueOrThrow({ where: { id: userId } })
        const host = await tx.tripMember.findFirst({
          where: { tripId: row.tripId, userId: row.trip.creatorId, role: 'HOST', status: 'ACTIVE' },
        })
        const count = await tx.tripMember.count({ where: { tripId: row.tripId, status: 'ACTIVE' } })
        return {
          ...this.view(row),
          ...state,
          expiresAt: new Date(Math.min(+row.expiresAt, +row.trip.startAt - 1000)).toISOString(),
          senderDisplay: row.sender.fullName,
          recipientDisplay: row.recipient.fullName,
          trip: {
            id: row.tripId,
            title: row.trip.title,
            startAt: row.trip.startAt.toISOString(),
            endAt: row.trip.endAt.toISOString(),
            status: row.trip.status,
          },
          actions: {
            canAccept:
              state.status === 'PENDING' &&
              row.recipientUserId === userId &&
              actor.role === 'USER' &&
              row.trip.status === 'OPEN' &&
              row.trip.startAt > now &&
              !!host &&
              (!member || member.status === 'LEFT') &&
              count < row.trip.maxPax,
            canEnterRoom: row.trip.creatorId === userId || member?.status === 'ACTIVE',
            canDecline: state.status === 'PENDING' && row.recipientUserId === userId,
            canRevoke: state.status === 'PENDING' && row.senderUserId === userId,
          },
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }
}
