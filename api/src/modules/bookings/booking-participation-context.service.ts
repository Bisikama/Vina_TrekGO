import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { hasPublicParticipationAccess } from './public-participation.policy'

/** Booking-owned facts for internal consumers, not a Rental eligibility decision.
 * Caller owns the transaction. No contact/payment/QR fields cross this boundary.
 */
@Injectable()
export class BookingParticipationContextService {
  async read(tx: Prisma.TransactionClient, tripId: string, userId: string) {
    const trip = await tx.trip.findUnique({ where: { id: tripId } })
    if (!trip || trip.tripType !== 'PUBLIC') return null
    const actor = await tx.user.findUnique({ where: { id: userId }, select: { status: true, role: true } })
    const actorActive = actor?.status === 'ACTIVE' && ['USER', 'LEADER'].includes(actor.role)
    const bookings = await tx.booking.findMany({
      where: { tripId, OR: [{ userId }, { bookingParticipantsViaBookingId: { some: { userId } } }] },
      include: { bookingParticipantsViaBookingId: { where: { userId }, orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    })
    return {
      contractVersion: '1.0',
      tripId,
      userId,
      actorActive,
      trip: {
        status: trip.status,
        version: trip.version,
        startAt: trip.startAt,
        endAt: trip.endAt,
        cancelledAt: trip.cancelledAt,
        completedAt: trip.completedAt,
        leaderId: trip.leaderId,
      },
      // Return all sources; Rental must explicitly select and persist its source, never infer it from bookingId alone.
      sources: bookings.flatMap((booking) => [
        ...(booking.userId === userId
          ? [
              {
                membershipKind: 'PUBLIC_BOOKING_BUYER' as const,
                membershipRef: booking.id,
                bookingId: booking.id,
                bookingVersion: booking.version,
                bookingStatus: booking.status,
                participantStatus: null,
                checkinStatus: null,
                sourceActive:
                  actorActive && ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'].includes(booking.status),
              },
            ]
          : []),
        ...booking.bookingParticipantsViaBookingId.map((p) => ({
          membershipKind: 'PUBLIC_PARTICIPANT' as const,
          membershipRef: p.id,
          bookingId: booking.id,
          bookingVersion: booking.version,
          bookingStatus: booking.status,
          participantStatus: p.status,
          checkinStatus: p.checkinStatus,
          sourceActive: actorActive && hasPublicParticipationAccess(p, booking, trip, userId),
        })),
      ]),
    }
  }

  /** Call before Rental locks quote/order/stock, in the SAME DB transaction as the write.
   * Serializes with Booking claim/cancel/check-in (Trip -> Booking -> Participant).
   * A remote HTTP snapshot cannot provide this guarantee. Rental integration remains pending.
   */
  async lockAndRead(tx: Prisma.TransactionClient, tripId: string, userId: string) {
    await tx.$queryRaw`SELECT id FROM trips WHERE id=${tripId}::uuid FOR UPDATE`
    return this.read(tx, tripId, userId)
  }
}
