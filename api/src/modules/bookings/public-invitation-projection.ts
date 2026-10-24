import { Booking, BookingParticipant, BookingParticipantInvitation, Prisma, Trip } from '@prisma/client'
import { claimEligible, publicInvitationState, transitionPublicInvitation } from './public-invitation.policy'

type Participant = BookingParticipant & {
  user: { fullName: string } | null
  invitations: (BookingParticipantInvitation & { recipient: { fullName: string; status: string; role: string } })[]
}
/** Additive buyer-only projection. Read effective state without mutating invitation history. */
export async function publicBookingLinkage(
  tx: Prisma.TransactionClient,
  booking: Booking,
  trip: Trip,
  participants: Participant[],
  now: Date,
) {
  const recipientIds = [
    ...new Set([booking.userId, ...participants.flatMap((p) => p.invitations.map((i) => i.recipientUserId))]),
  ]
  const linked = await tx.bookingParticipant.findMany({
    where: {
      userId: { in: recipientIds },
      status: 'ACTIVE',
      booking: { tripId: trip.id, status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'] } },
    },
    select: { id: true, userId: true },
  })
  return participants.map((p) => {
    const invitations = p.invitations.map((i) => {
      let state = publicInvitationState(i, p, booking, trip, now)
      if (
        state.status === 'PENDING' &&
        (i.recipient.status !== 'ACTIVE' || !['USER', 'LEADER'].includes(i.recipient.role))
      )
        state = { status: 'INVALIDATED', reason: 'RECIPIENT_UNAVAILABLE' }
      if (state.status === 'PENDING' && linked.some((l) => l.userId === i.recipientUserId && l.id !== p.id))
        state = { status: 'INVALIDATED', reason: 'TRIP_PARTICIPATION_EXISTS' }
      return {
        id: i.id,
        ...state,
        version: i.version,
        expiresAt: new Date(Math.min(+i.expiresAt, +trip.startAt - 1000)).toISOString(),
        recipientDisplay: i.recipient.fullName,
      }
    })
    const pending = invitations.find((i) => i.status === 'PENDING')
    const eligible = claimEligible(p, booking, trip, now)
    return {
      linkageStatus: p.userId ? 'CLAIMED' : pending ? 'INVITATION_PENDING' : 'UNLINKED',
      pendingInvitationId: pending?.id ?? null,
      recipientDisplay: p.userId ? p.user?.fullName ?? null : pending?.recipientDisplay ?? null,
      invitations,
      actions: {
        canInvite: eligible && !pending,
        canSelfClaim: eligible && !pending && !linked.some((l) => l.userId === booking.userId && l.id !== p.id),
        canRevoke: !!pending,
      },
    }
  })
}
/** Booking cancellation already holds Trip -> Booking; acquire participants and invitations in stable order. */
export async function invalidatePublicBookingInvitations(
  tx: Prisma.TransactionClient,
  booking: Booking,
  actorId: string,
  now: Date,
) {
  const rows = await tx.bookingParticipantInvitation.findMany({
    where: { status: 'PENDING', participant: { bookingId: booking.id } },
    orderBy: [{ bookingParticipantId: 'asc' }, { id: 'asc' }],
  })
  for (const row of rows) {
    await tx.$queryRaw`SELECT id FROM booking_participants WHERE id=${row.bookingParticipantId}::uuid FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM booking_participant_invitations WHERE id=${row.id}::uuid FOR UPDATE`
    await transitionPublicInvitation(tx, row, booking, actorId, now, 'INVALIDATED', 'BOOKING_NOT_ELIGIBLE')
  }
}
