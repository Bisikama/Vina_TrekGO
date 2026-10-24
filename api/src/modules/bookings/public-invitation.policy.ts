import {
  Booking,
  BookingParticipant,
  BookingParticipantInvitation,
  Trip,
  Prisma,
  InvitationStatus,
} from '@prisma/client'
import { AppError, COMMON_ERROR_CODES as C } from '../../shared/errors'

export function publicInvitationConfig() {
  const value = (suffix: string, fallback: number, max: number) => {
    const n = Number(process.env[`PUBLIC_INVITATION_${suffix}`] ?? fallback)
    if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error(`Invalid PUBLIC_INVITATION_${suffix}`)
    return n
  }
  return {
    ttlSeconds: value('TTL_SECONDS', 604800, 2592000),
    replaySeconds: value('REPLAY_SECONDS', 86400, 604800),
    createPerMinute: value('CREATE_PER_MINUTE', 10, 1000),
    createPerDay: value('CREATE_PER_DAY', 50, 10000),
    mutatePerMinute: value('MUTATE_PER_MINUTE', 30, 1000),
  }
}
export function publicInvitationExpiry(now: Date, startAt: Date, requested?: string) {
  const expiry = Math.min(
    requested ? +new Date(requested) : Infinity,
    +now + publicInvitationConfig().ttlSeconds * 1000,
    +startAt - 1000,
  )
  if (!Number.isFinite(expiry) || expiry <= +now)
    throw AppError.fromCode(C.VALIDATION_ERROR, { details: { reason: 'INVALID_INVITATION_EXPIRY' } })
  return new Date(expiry)
}
export function claimEligible(p: BookingParticipant, b: Booking, t: Trip, now: Date) {
  return (
    t.tripType === 'PUBLIC' &&
    ['OPEN', 'FULL', 'CLOSED'].includes(t.status) &&
    t.startAt > now &&
    b.status === 'CONFIRMED' &&
    p.status === 'ACTIVE' &&
    p.checkinStatus === 'NOT_CHECKED_IN' &&
    !p.checkedInAt &&
    !p.userId
  )
}
export function publicInvitationState(
  i: BookingParticipantInvitation,
  p: BookingParticipant,
  b: Booking,
  t: Trip,
  now: Date,
): { status: InvitationStatus; reason: string | null } {
  if (i.status !== 'PENDING') return { status: i.status, reason: i.reason }
  let reason: string | null = null
  if (
    t.tripType !== 'PUBLIC' ||
    ['CANCELLED', 'INTERRUPTED', 'COMPLETED', 'CANCEL_PENDING', 'DRAFT'].includes(t.status)
  )
    reason = 'TRIP_NOT_ELIGIBLE'
  else if (b.status !== 'CONFIRMED') reason = 'BOOKING_NOT_ELIGIBLE'
  else if (p.userId) reason = 'PARTICIPANT_ALREADY_LINKED'
  else if (p.status !== 'ACTIVE' || p.checkinStatus !== 'NOT_CHECKED_IN' || p.checkedInAt)
    reason = 'PARTICIPANT_NOT_ELIGIBLE'
  if (reason) return { status: 'INVALIDATED', reason }
  if (Math.min(+i.expiresAt, +t.startAt - 1000) <= +now) return { status: 'EXPIRED', reason: 'EXPIRED' }
  if (!claimEligible(p, b, t, now)) return { status: 'INVALIDATED', reason: 'TRIP_NOT_ELIGIBLE' }
  return { status: 'PENDING', reason: null }
}
export async function recordPublicInvitation(
  tx: Prisma.TransactionClient,
  row: BookingParticipantInvitation,
  booking: Booking,
  actorId: string,
  previousStatus: string | null,
) {
  const eventType = previousStatus === null ? 'PUBLIC_PARTICIPANT_INVITED' : `PUBLIC_INVITATION_${row.status}`
  await tx.auditLog.create({
    data: {
      userId: actorId,
      action: eventType,
      entityType: 'BookingParticipantInvitation',
      entityId: row.id,
      oldValues: { status: previousStatus },
      newValues: {
        status: row.status,
        reason: row.reason,
        version: row.version,
        expiresAt: row.expiresAt.toISOString(),
      },
    },
  })
  await tx.bookingOutboxEvent.create({
    data: {
      eventType,
      aggregateType: 'Booking',
      aggregateId: booking.id,
      deduplicationKey: `${eventType}:${row.id}:${row.version}`,
      payload: {
        schemaVersion: 1,
        invitationId: row.id,
        participantId: row.bookingParticipantId,
        bookingId: booking.id,
        tripId: booking.tripId,
        senderUserId: row.senderUserId,
        recipientUserId: row.recipientUserId,
        status: row.status,
        reason: row.reason,
        version: row.version,
      },
    },
  })
}
/** Caller holds Trip -> Booking -> Participant -> Invitation locks. */
export async function transitionPublicInvitation(
  tx: Prisma.TransactionClient,
  row: BookingParticipantInvitation,
  booking: Booking,
  actorId: string,
  now: Date,
  status: InvitationStatus,
  reason: string | null = null,
) {
  const next = await tx.bookingParticipantInvitation.update({
    where: { id: row.id },
    data: {
      status,
      reason,
      version: { increment: 1 },
      ...(status === 'INVALIDATED' ? { invalidatedAt: now } : {}),
      ...(['ACCEPTED', 'DECLINED', 'REVOKED'].includes(status) ? { respondedAt: now } : {}),
    },
  })
  await recordPublicInvitation(tx, next, booking, actorId, row.status)
  return next
}
