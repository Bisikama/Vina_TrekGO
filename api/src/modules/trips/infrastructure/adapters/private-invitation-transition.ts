import { InvitationStatus, Prisma, PrivateTripMemberInvitation } from '@prisma/client'

export async function recordInvitation(
  tx: Prisma.TransactionClient,
  row: PrivateTripMemberInvitation,
  actorId: string,
  previousStatus: string | null,
) {
  const eventType =
    previousStatus === null
      ? 'PRIVATE_TRIP_MEMBER_INVITED'
      : `PRIVATE_TRIP_MEMBER_INVITATION_${previousStatus === row.status ? 'UPDATED' : row.status}`
  await tx.auditLog.create({
    data: {
      userId: actorId,
      action: eventType,
      entityType: 'PRIVATE_TRIP_MEMBER_INVITATION',
      entityId: row.id,
      oldValues: { status: previousStatus },
      newValues: {
        status: row.status,
        reason: row.reason,
        version: row.version,
        expiresAt: row.expiresAt.toISOString(),
        acceptedMemberId: row.acceptedMemberId,
        membershipVersionAtAccept: row.membershipVersionAtAccept,
      },
    },
  })
  await tx.bookingOutboxEvent.create({
    data: {
      eventType,
      aggregateType: 'PRIVATE_TRIP',
      aggregateId: row.tripId,
      deduplicationKey: `${eventType}:${row.id}:${row.version}`,
      payload: {
        schemaVersion: 1,
        invitationId: row.id,
        tripId: row.tripId,
        recipientUserId: row.recipientUserId,
        actorId,
        status: row.status,
        reason: row.reason,
        version: row.version,
      },
    },
  })
}
export async function transitionInvitation(
  tx: Prisma.TransactionClient,
  row: PrivateTripMemberInvitation,
  actorId: string,
  now: Date,
  status: InvitationStatus,
  reason: string | null = null,
  extra: Prisma.PrivateTripMemberInvitationUncheckedUpdateInput = {},
) {
  const next = await tx.privateTripMemberInvitation.update({
    where: { id: row.id },
    data: {
      ...extra,
      status,
      reason,
      version: { increment: 1 },
      ...(status === 'INVALIDATED' ? { invalidatedAt: now } : {}),
      ...(['DECLINED', 'REVOKED'].includes(status) ? { respondedAt: now } : {}),
    },
  })
  await recordInvitation(tx, next, actorId, row.status)
  return next
}

// All callers hold Trip before locking source invitations, including M2 revoke.
export async function syncPendingInvitations(
  tx: Prisma.TransactionClient,
  tripId: string,
  actorId: string,
  now: Date,
  options: { recipientUserId?: string; reason?: string; startAt?: Date },
) {
  const rows = await tx.privateTripMemberInvitation.findMany({
    where: {
      tripId,
      recipientUserId: options.recipientUserId,
      status: 'PENDING',
    },
    orderBy: { id: 'asc' },
  })
  for (const row of rows) {
    await tx.$queryRaw`SELECT id FROM private_trip_member_invitations WHERE id=${row.id}::uuid FOR UPDATE`
    if (options.reason) {
      await transitionInvitation(tx, row, actorId, now, 'INVALIDATED', options.reason)
    } else if (options.startAt) {
      const expiresAt = new Date(Math.min(+row.expiresAt, +options.startAt - 1000))
      if (expiresAt <= now) await transitionInvitation(tx, row, actorId, now, 'EXPIRED', 'EXPIRED', { expiresAt })
      else if (+expiresAt !== +row.expiresAt) {
        await transitionInvitation(tx, row, actorId, now, 'PENDING', null, { expiresAt })
      }
    }
  }
}
