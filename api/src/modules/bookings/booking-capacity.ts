import { Prisma } from '@prisma/client'
import { DEFAULT_REGISTRATION_LEAD_MS } from '../trips/application/trip.policy'

export const databaseTime = async (tx: Prisma.TransactionClient) =>
  (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0].now

export function effectiveRegistrationOpen(trip: {
  publishedAt?: Date | null
  registrationOpenAt?: Date | null
}): Date | null {
  return trip.registrationOpenAt ?? trip.publishedAt ?? null
}

export function effectiveRegistrationDeadline(trip: {
  startAt: Date
  registrationDeadlineAt?: Date | null
}): Date {
  return trip.registrationDeadlineAt ?? new Date(trip.startAt.getTime() - DEFAULT_REGISTRATION_LEAD_MS)
}

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

// Caller holds the Trip row lock. Synchronizes OPEN <-> FULL -> CLOSED based on deadline and occupied seats.
export async function syncTripRegistrationState(tx: Prisma.TransactionClient, tripId: string, now: Date) {
  const trip = await tx.trip.findUnique({ where: { id: tripId } })
  if (!trip || trip.tripType !== 'PUBLIC' || !['OPEN', 'FULL'].includes(trip.status)) {
    return trip
  }
  const deadline = effectiveRegistrationDeadline(trip)
  if (now >= deadline) {
    return tx.trip.update({
      where: { id: tripId },
      data: {
        status: 'CLOSED',
        closedAt: trip.closedAt ?? deadline,
        version: { increment: 1 },
      },
    })
  }
  const occupied = await occupiedSeats(tx, tripId, now)
  if (occupied >= trip.maxPax && trip.status === 'OPEN') {
    return tx.trip.update({
      where: { id: tripId },
      data: { status: 'FULL', version: { increment: 1 } },
    })
  }
  if (occupied < trip.maxPax && trip.status === 'FULL') {
    return tx.trip.update({
      where: { id: tripId },
      data: { status: 'OPEN', version: { increment: 1 } },
    })
  }
  return trip
}

// Caller holds the Trip row lock. Do not change financial Payment state on domain expiry.
export async function expireTripHolds(tx: Prisma.TransactionClient, tripId: string, now: Date) {
  const expired = await tx.booking.findMany({
    where: { tripId, status: 'PENDING_PAYMENT', expiresAt: { lte: now } },
    select: { id: true },
  })
  if (expired.length) {
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
  }
  await syncTripRegistrationState(tx, tripId, now)
  return expired.length
}
