import { Injectable } from '@nestjs/common'
import { Booking, BookingParticipant, BookingParticipantInvitation, Prisma, Trip, User } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { InvitationRequestService } from '../../shared/services/invitation-request.service'
import { AppError, BOOKING_ERROR_CODES as B, COMMON_ERROR_CODES as C } from '../../shared/errors'
import { databaseTime } from './booking-capacity'
import { ParticipantClaimService, assertTicketActor, ticketAccess } from './participant-claim.service'
import {
  claimEligible,
  publicInvitationConfig,
  publicInvitationExpiry,
  publicInvitationState,
  recordPublicInvitation,
  transitionPublicInvitation,
} from './public-invitation.policy'
import type { PublicInvitationCreate, PublicInvitationPage } from './public-invitations.dto'

const include = {
  participant: {
    include: { booking: { include: { trip: { include: { destination: { select: { id: true, name: true } } } } } } },
  },
  sender: { select: { fullName: true } },
  recipient: { select: { fullName: true, status: true, role: true } },
} as const
type Row = Prisma.BookingParticipantInvitationGetPayload<{ include: typeof include }>
const fail = (code: string): never => {
  throw AppError.fromCode(code)
}
@Injectable()
export class PublicInvitationRequestService extends InvitationRequestService {
  constructor(db: PrismaService) {
    super(db, 'public', publicInvitationConfig)
  }
}
@Injectable()
export class PublicInvitationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly requests: PublicInvitationRequestService,
    private readonly claims: ParticipantClaimService,
  ) {}
  private async lock(tx: Prisma.TransactionClient, bookingId: string, participantId: string) {
    const initial = await tx.booking.findUnique({ where: { id: bookingId } })
    if (!initial) return fail(B.NOT_FOUND)
    await tx.$queryRaw`SELECT id FROM trips WHERE id=${initial.tripId}::uuid FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM bookings WHERE id=${bookingId}::uuid FOR UPDATE`
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } })
    if (booking.tripId !== initial.tripId) return fail(B.NOT_FOUND)
    const trip = await tx.trip.findUniqueOrThrow({ where: { id: booking.tripId } })
    if (trip.tripType !== 'PUBLIC') return fail(B.NOT_FOUND)
    await tx.$queryRaw`SELECT id FROM booking_participants WHERE id=${participantId}::uuid AND booking_id=${bookingId}::uuid FOR UPDATE`
    const participant = await tx.bookingParticipant.findFirst({ where: { id: participantId, bookingId } })
    if (!participant) return fail(B.NOT_FOUND)
    return { booking, trip, participant }
  }
  private base(row: BookingParticipantInvitation) {
    return {
      id: row.id,
      participantId: row.bookingParticipantId,
      status: row.status,
      reason: row.reason,
      version: row.version,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }
  }
  async create(actorId: string, bookingId: string, participantId: string, key: string, input: PublicInvitationCreate) {
    await assertTicketActor(this.db, actorId)
    if (
      !(await this.db.bookingParticipant.findFirst({
        where: { id: participantId, bookingId, booking: { userId: actorId, trip: { tripType: 'PUBLIC' } } },
      }))
    )
      return fail(B.NOT_FOUND)
    return this.requests.create(actorId, `${bookingId}:${participantId}`, key, input, async (tx) => {
      const { booking, participant, trip } = await this.lock(tx, bookingId, participantId)
      await assertTicketActor(tx, actorId)
      if (booking.userId !== actorId) return fail(B.NOT_FOUND)
      let pending = await tx.bookingParticipantInvitation.findFirst({
        where: { bookingParticipantId: participantId, status: 'PENDING' },
      })
      if (pending)
        await tx.$queryRaw`SELECT id FROM booking_participant_invitations WHERE id=${pending.id}::uuid FOR UPDATE`
      const now = await databaseTime(tx)
      if (pending) {
        const state = publicInvitationState(pending, participant, booking, trip, now)
        if (state.status !== 'PENDING') {
          await transitionPublicInvitation(tx, pending, booking, actorId, now, state.status, state.reason)
          pending = null
        }
      }
      // Return business errors to commit a terminal transition; technical failures roll back all writes.
      try {
        if (participant.userId) return fail(B.PARTICIPANT_ALREADY_LINKED)
        if (!claimEligible(participant, booking, trip, now)) return fail(B.PARTICIPANT_CLAIM_NOT_ALLOWED)
        if (pending) return fail(B.PENDING_INVITATION_EXISTS)
        const expiresAt = publicInvitationExpiry(now, trip.startAt, input.expiresAt)
        const candidates = await tx.$queryRaw<
          Pick<User, 'id' | 'role' | 'status' | 'fullName'>[]
        >`SELECT id, role, status, full_name AS "fullName" FROM users WHERE lower(btrim(email))=${input.recipientEmail} LIMIT 2`
        const recipient = candidates[0]
        if (candidates.length !== 1 || recipient.status !== 'ACTIVE' || !['USER', 'LEADER'].includes(recipient.role))
          return fail(B.INVITATION_RECIPIENT_UNAVAILABLE)
        if (recipient.id === actorId)
          throw AppError.fromCode(C.VALIDATION_ERROR, { details: { reason: 'USE_SELF_CLAIM' } })
        if (await this.duplicate(tx, recipient.id, trip.id, participant.id))
          return fail(B.INVITATION_RECIPIENT_UNAVAILABLE)
        const row = await tx.bookingParticipantInvitation.create({
          data: {
            bookingParticipantId: participantId,
            senderUserId: actorId,
            recipientUserId: recipient.id,
            recipientEmailSnapshot: input.recipientEmail,
            expiresAt,
          },
        })
        await recordPublicInvitation(tx, row, booking, actorId, null)
        return { ...this.base(row), recipientDisplay: recipient.fullName }
      } catch (error) {
        if (error instanceof AppError) return { error }
        throw error
      }
    })
  }
  private duplicate(tx: Prisma.TransactionClient, userId: string, tripId: string, participantId: string) {
    return tx.bookingParticipant.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        id: { not: participantId },
        booking: { tripId, status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'] } },
      },
      select: { id: true },
    })
  }
  private async state(tx: Prisma.TransactionClient, row: Row, now: Date) {
    const p = row.participant,
      b = p.booking,
      t = b.trip
    const state = publicInvitationState(row, p, b, t, now)
    if (state.status === 'PENDING') {
      if (row.recipient.status !== 'ACTIVE' || !['USER', 'LEADER'].includes(row.recipient.role))
        return { status: 'INVALIDATED' as const, reason: 'RECIPIENT_UNAVAILABLE' }
      if (await this.duplicate(tx, row.recipientUserId, t.id, p.id))
        return { status: 'INVALIDATED' as const, reason: B.TRIP_PARTICIPATION_EXISTS }
    }
    return state
  }
  private async view(tx: Prisma.TransactionClient, row: Row, actorId: string, now: Date) {
    const p = row.participant,
      b = p.booking,
      t = b.trip
    const state = await this.state(tx, row, now)
    return {
      ...this.base(row),
      ...state,
      expiresAt: new Date(Math.min(+row.expiresAt, +t.startAt - 1000)).toISOString(),
      senderDisplay: row.sender.fullName,
      recipientDisplay: row.recipient.fullName,
      participantName: p.fullName,
      trip: {
        id: t.id,
        title: t.title,
        status: t.status,
        startAt: t.startAt.toISOString(),
        endAt: t.endAt.toISOString(),
        destination: t.destination,
      },
      actions: {
        canAccept: state.status === 'PENDING' && row.recipientUserId === actorId,
        canDecline: state.status === 'PENDING' && row.recipientUserId === actorId,
        canRevoke: state.status === 'PENDING' && row.senderUserId === actorId && b.userId === actorId,
      },
      ticketId: row.status === 'ACCEPTED' && p.userId === actorId ? p.id : null,
      currentAccess: {
        ...ticketAccess(p, b, t),
        participantActive: p.userId === actorId && ticketAccess(p, b, t).participantActive,
      },
    }
  }
  async preview(actorId: string, id: string) {
    return this.db.$transaction(
      async (tx) => {
        await assertTicketActor(tx, actorId)
        const row = await tx.bookingParticipantInvitation.findFirst({
          where: {
            id,
            OR: [
              { recipientUserId: actorId },
              { senderUserId: actorId, participant: { booking: { userId: actorId } } },
            ],
          },
          include,
        })
        if (!row) return fail(B.NOT_FOUND)
        return this.view(tx, row, actorId, await databaseTime(tx))
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }
  async change(actorId: string, id: string, action: 'ACCEPTED' | 'DECLINED' | 'REVOKED', reason?: string) {
    await assertTicketActor(this.db, actorId)
    await this.requests.consumeRate(actorId, 'mutation')
    const outcome = await this.db.$transaction(
      async (tx) => {
        const scope =
          action === 'REVOKED'
            ? { senderUserId: actorId, participant: { booking: { userId: actorId } } }
            : { recipientUserId: actorId }
        const initial = await tx.bookingParticipantInvitation.findFirst({
          where: { id, ...scope },
          include: { participant: { select: { bookingId: true } } },
        })
        if (!initial) return fail(B.NOT_FOUND)
        const { booking, participant, trip } = await this.lock(
          tx,
          initial.participant.bookingId,
          initial.bookingParticipantId,
        )
        await tx.$queryRaw`SELECT id FROM booking_participant_invitations WHERE id=${id}::uuid FOR UPDATE`
        const row = await tx.bookingParticipantInvitation.findFirst({ where: { id, ...scope }, include })
        if (!row) return fail(B.NOT_FOUND)
        await assertTicketActor(tx, actorId)
        const now = await databaseTime(tx)
        if (row.status === action) return { body: await this.view(tx, row, actorId, now) }
        if (row.status === 'ACCEPTED') return { error: AppError.fromCode(B.INVALID_STATE_TRANSITION) }
        const state = await this.state(tx, row, now)
        if (state.status !== row.status)
          await transitionPublicInvitation(tx, row, booking, actorId, now, state.status, state.reason)
        if (state.status !== 'PENDING') {
          const code =
            state.status === 'EXPIRED'
              ? B.INVITE_EXPIRED
              : row.status === 'PENDING' &&
                  [B.PARTICIPANT_ALREADY_LINKED, B.TRIP_PARTICIPATION_EXISTS].includes(state.reason as any)
                ? state.reason!
                : B.INVITATION_NOT_ACTIONABLE
          return { error: AppError.fromCode(code, { details: state }) }
        }
        if (action === 'ACCEPTED') {
          // Identity confirmation is validated by the HTTP DTO before entering this method.
          await this.claims.claimLocked(tx, actorId, trip, booking, participant, now)
        }
        await transitionPublicInvitation(tx, row, booking, actorId, now, action, reason ?? null)
        const next = await tx.bookingParticipantInvitation.findUniqueOrThrow({ where: { id }, include })
        return { body: await this.view(tx, next, actorId, now) }
      },
      { timeout: 15000 },
    )
    if (outcome.error) throw outcome.error
    return outcome.body
  }
  async list(actorId: string, page: PublicInvitationPage) {
    return this.db.$transaction(
      async (tx) => {
        await assertTicketActor(tx, actorId)
        const now = await databaseTime(tx)
        // Effective-state filtering precedes pagination, including duplicate claims in other bookings.
        const effective = Prisma.sql`CASE WHEN i.status <> 'PENDING' THEN i.status::text
        WHEN t.trip_type <> 'PUBLIC' OR t.status IN ('CANCELLED','INTERRUPTED','COMPLETED','CANCEL_PENDING','DRAFT') OR b.status <> 'CONFIRMED' OR p.user_id IS NOT NULL OR p.status <> 'ACTIVE' OR p.checkin_status <> 'NOT_CHECKED_IN' OR p.checked_in_at IS NOT NULL THEN 'INVALIDATED'
        WHEN LEAST(i.expires_at,t.start_at - interval '1 second') <= ${now} THEN 'EXPIRED'
        WHEN t.status NOT IN ('OPEN','FULL','CLOSED') OR u.status <> 'ACTIVE' OR u.role NOT IN ('USER','LEADER') OR EXISTS (SELECT 1 FROM booking_participants p2 JOIN bookings b2 ON b2.id=p2.booking_id WHERE p2.id<>p.id AND p2.user_id=i.recipient_user_id AND p2.status='ACTIVE' AND b2.trip_id=t.id AND b2.status IN ('CONFIRMED','PARTIAL_CHECKIN','CHECKED_IN','COMPLETED')) THEN 'INVALIDATED' ELSE 'PENDING' END`
        const from = Prisma.sql`FROM booking_participant_invitations i JOIN booking_participants p ON p.id=i.booking_participant_id JOIN bookings b ON b.id=p.booking_id JOIN trips t ON t.id=b.trip_id JOIN users u ON u.id=i.recipient_user_id WHERE i.recipient_user_id=${actorId}::uuid`
        const filter = page.status ? Prisma.sql`AND (${effective})=${page.status}` : Prisma.empty
        const counts = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT count(*) AS total ${from} ${filter}`)
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT i.id ${from} ${filter} ORDER BY i.created_at DESC,i.id DESC LIMIT ${page.pageSize} OFFSET ${(page.page - 1) * page.pageSize}`,
        )
        const rows = await tx.bookingParticipantInvitation.findMany({
          where: { id: { in: ids.map((r) => r.id) } },
          include,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
        const total = Number(counts[0].total)
        return {
          items: await Promise.all(rows.map((r) => this.view(tx, r, actorId, now))),
          page: page.page,
          pageSize: page.pageSize,
          total,
          totalPages: Math.ceil(total / page.pageSize),
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    )
  }
}
