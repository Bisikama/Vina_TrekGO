import { resolvedPublicInvitationState, transitionPublicInvitation } from './public-invitation.policy'
import { Injectable } from '@nestjs/common'
import { Booking, BookingParticipant, Prisma, Trip } from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B, COMMON_ERROR_CODES as C } from '../../shared/errors'
import { databaseTime } from './booking-capacity'
import { hasPublicParticipationAccess } from './public-participation.policy'

const fail = (code: string): never => {
  throw AppError.fromCode(code)
}
export async function assertTicketActor(tx: Prisma.TransactionClient, userId: string) {
  const actor = await tx.user.findUnique({ where: { id: userId } })
  if (!actor) return fail(C.UNAUTHENTICATED)
  if (actor.status !== 'ACTIVE' || !['USER', 'LEADER'].includes(actor.role)) fail(C.FORBIDDEN)
}
export function ticketAccess(participant: BookingParticipant, booking: Booking, trip: Trip, actorId = participant.userId) {
  const participantActive = hasPublicParticipationAccess(participant, booking, trip, actorId)
  return {
    participantActive,
    // Rental integration remains a separate gate; preserve the current check-in contract.
    canNavigate: participantActive,
    canRent: false,
    canCheckIn: participantActive && participant.checkinStatus === 'NOT_CHECKED_IN',
    reason: 'INTEGRATION_NOT_VERIFIED',
  }
}

@Injectable()
export class ParticipantClaimService {
  constructor(private readonly db: PrismaService) {}

  /** Reused by M6 inside the same Trip -> Booking -> Participant -> Invitation transaction. */
  async claimLocked(
    tx: Prisma.TransactionClient,
    actorId: string,
    trip: Trip,
    booking: Booking,
    participant: BookingParticipant,
    now: Date,
  ) {
    if (participant.userId === actorId) return { participant, booking, alreadyClaimed: true }
    if (participant.userId) return fail(B.PARTICIPANT_ALREADY_LINKED)
    if (
      trip.tripType !== 'PUBLIC' ||
      !['OPEN', 'FULL', 'CLOSED'].includes(trip.status) ||
      trip.startAt <= now ||
      booking.status !== 'CONFIRMED' ||
      participant.status !== 'ACTIVE' ||
      participant.checkinStatus !== 'NOT_CHECKED_IN' ||
      participant.checkedInAt
    )
      return fail(B.PARTICIPANT_CLAIM_NOT_ALLOWED)
    const duplicate = await tx.bookingParticipant.findFirst({
      where: {
        userId: actorId,
        status: 'ACTIVE',
        id: { not: participant.id },
        booking: { tripId: trip.id, status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'] } },
      },
    })
    if (duplicate) return fail(B.TRIP_PARTICIPATION_EXISTS)
    const next = await tx.bookingParticipant.update({
      where: { id: participant.id },
      data: { userId: actorId, checkinCode: randomUUID() },
    })
    const nextBooking = await tx.booking.update({ where: { id: booking.id }, data: { version: { increment: 1 } } })
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: 'PUBLIC_PARTICIPANT_CLAIMED',
        entityType: 'BookingParticipant',
        entityId: participant.id,
        oldValues: { userId: null, bookingVersion: booking.version },
        newValues: {
          userId: actorId,
          bookingVersion: nextBooking.version,
          confirmParticipantIdentity: true,
          participantSnapshot: { fullName: participant.fullName },
          confirmedAt: now.toISOString(),
        },
      },
    })
    await tx.bookingOutboxEvent.create({
      data: {
        eventType: 'PUBLIC_PARTICIPANT_CLAIMED',
        aggregateType: 'Booking',
        aggregateId: booking.id,
        deduplicationKey: `PUBLIC_PARTICIPANT_CLAIMED:${participant.id}:${nextBooking.version}`,
        payload: {
          schemaVersion: 1,
          participantId: participant.id,
          bookingId: booking.id,
          tripId: trip.id,
          buyerUserId: booking.userId,
          recipientUserId: actorId,
          bookingVersion: nextBooking.version,
          occurredAt: now.toISOString(),
        },
      },
    })
    return { participant: next, booking: nextBooking, alreadyClaimed: false }
  }

  async selfClaim(actorId: string, bookingId: string, participantId: string) {
    // READ COMMITTED: all claim writers serialize on Trip, and reread each source after its lock.
    const outcome = await this.db.$transaction(
      async (tx) => {
        await assertTicketActor(tx, actorId)
        const initial = await tx.booking.findFirst({ where: { id: bookingId, userId: actorId } })
        if (!initial) return fail(B.NOT_FOUND)
        await tx.$queryRaw`SELECT id FROM trips WHERE id=${initial.tripId}::uuid FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM bookings WHERE id=${bookingId}::uuid FOR UPDATE`
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } })
        if (booking.userId !== actorId || booking.tripId !== initial.tripId) return fail(B.NOT_FOUND)
        const trip = await tx.trip.findUniqueOrThrow({ where: { id: booking.tripId } })
        if (trip.tripType !== 'PUBLIC') return fail(B.NOT_FOUND)
        await tx.$queryRaw`SELECT id FROM booking_participants WHERE id=${participantId}::uuid AND booking_id=${bookingId}::uuid FOR UPDATE`
        const participant = await tx.bookingParticipant.findFirst({ where: { id: participantId, bookingId } })
        if (!participant) return fail(B.NOT_FOUND)
        const pending = await tx.bookingParticipantInvitation.findFirst({
          where: { bookingParticipantId: participantId, status: 'PENDING' },
        })
        if (pending)
          await tx.$queryRaw`SELECT id FROM booking_participant_invitations WHERE id=${pending.id}::uuid FOR UPDATE`
        const now = await databaseTime(tx)
        await assertTicketActor(tx, actorId)
        if (participant.userId !== actorId && pending) {
          const state = await resolvedPublicInvitationState(tx, pending, participant, booking, trip, now)
          if (state.status === 'PENDING') return fail(B.PENDING_INVITATION_EXISTS)
          await transitionPublicInvitation(tx, pending, booking, actorId, now, state.status, state.reason)
        }

        // Business failures before mutation must not roll back a lazy-expiry transition.
        let result: Awaited<ReturnType<ParticipantClaimService['claimLocked']>>
        try {
          result = await this.claimLocked(tx, actorId, trip, booking, participant, now)
        } catch (error) {
          if (error instanceof AppError) return { error }
          throw error
        }
        return {
          body: {
            ticketId: participant.id,
            tripId: trip.id,
            alreadyClaimed: result.alreadyClaimed,
            participantStatus: result.participant.status,
            bookingVersion: result.booking.version,
            currentAccess: ticketAccess(result.participant, result.booking, trip),
          },
        }
      },
      { timeout: 15000 },
    )
    if (outcome.error) throw outcome.error
    return outcome.body
  }
}
