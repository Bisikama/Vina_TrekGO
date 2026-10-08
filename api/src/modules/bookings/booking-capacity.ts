import { Prisma } from '@prisma/client'

export const databaseTime = async (tx: Prisma.TransactionClient) =>
  (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now

export const occupiedSeats = async (tx: Prisma.TransactionClient, tripId: string, now: Date, exceptId?: string) =>
  tx.bookingParticipant.count({
    where: {
      status: 'ACTIVE',
      booking: {
        tripId,
        ...(exceptId ? { id: { not: exceptId } } : {}),
        OR: [
          { status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN'] } },
          { status: 'PENDING_PAYMENT', expiresAt: { gt: now } },
        ],
      },
    },
  })

// Caller holds the Trip row lock. Do not change financial Payment state on domain expiry.
export async function expireTripHolds(tx: Prisma.TransactionClient, tripId: string, now: Date) {
  const expired = await tx.booking.findMany({
    where: { tripId, status: 'PENDING_PAYMENT', expiresAt: { lte: now } },
    select: { id: true },
  })
  if (!expired.length) return 0
  const ids = expired.map((b) => b.id)
  await tx.booking.updateMany({
    where: { id: { in: ids }, status: 'PENDING_PAYMENT' },
    data: { status: 'EXPIRED', version: { increment: 1 } },
  })
  await tx.bookingParticipant.updateMany({
    where: { bookingId: { in: ids }, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  })
  await tx.invoice.updateMany({
    where: { bookingId: { in: ids }, status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
    data: { status: 'EXPIRED', version: { increment: 1 } },
  })
  return ids.length
}
