import { Booking, BookingParticipant, BookingStatus, Trip, TripStatus } from '@prisma/client'

export const PUBLIC_PARTICIPATION_BOOKING_STATUSES: BookingStatus[] = ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN']
export const PUBLIC_PARTICIPATION_TRIP_STATUSES: TripStatus[] = ['OPEN', 'FULL', 'CLOSED', 'IN_PROGRESS']

/** Rights attached to this participant only, independent of buyer/management rights. */
export function hasPublicParticipationAccess(p: BookingParticipant, b: Booking, t: Trip, actorId = p.userId) {
  return (
    !!actorId &&
    p.userId === actorId &&
    t.tripType === 'PUBLIC' &&
    p.status === 'ACTIVE' &&
    PUBLIC_PARTICIPATION_BOOKING_STATUSES.includes(b.status) &&
    PUBLIC_PARTICIPATION_TRIP_STATUSES.includes(t.status)
  )
}
