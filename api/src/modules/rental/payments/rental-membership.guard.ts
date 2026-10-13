import type { Prisma } from '@prisma/client'

/** Payment-time guard for Rental v1.2. Booking is provenance, never authorization.
 * This monolith reads Area A's owned TripMember table; if the services split,
 * replace this guard with the same trusted Area A TripRentalContext contract.
 */
export async function rentalMembershipValid(
  tx: Prisma.TransactionClient,
  order: { userId: string; tripId: string; membershipRef: string | null },
): Promise<boolean> {
  const member = await tx.tripMember.findUnique({
    where: { tripId_userId: { tripId: order.tripId, userId: order.userId } },
    select: { id: true, status: true, trip: { select: { status: true } } },
  })
  return !!member && member.status === 'ACTIVE' &&
    (!order.membershipRef || order.membershipRef === member.id) &&
    !['DRAFT', 'CANCEL_PENDING', 'CANCELLED', 'INTERRUPTED', 'COMPLETED'].includes(member.trip.status)
}
