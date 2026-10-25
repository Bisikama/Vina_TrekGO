import type { Prisma } from '@prisma/client'
import { confirmedPublicBookingOwnerId, VALID_PUBLIC_BOOKING_STATUSES } from '../shared/public-booking-membership'

const INACTIVE_TRIP_STATUSES = ['DRAFT', 'CANCEL_PENDING', 'CANCELLED', 'INTERRUPTED', 'COMPLETED']

/** Payment-time guard for Rental. Booking is provenance, never authorization.
 * Handles polymorphic membership checking between Private Trips (trip_members)
 * and Public Trips (booking_participants / leader), with safe legacy order compatibility.
 */
export async function rentalMembershipValid(
  tx: Prisma.TransactionClient,
  order: { userId: string; tripId: string; membershipRef: string | null; bookingId?: string | null },
): Promise<boolean> {
  const trip = await tx.trip.findUnique({
    where: { id: order.tripId },
    select: { id: true, status: true, tripType: true, leaderId: true },
  })
  if (!trip || INACTIVE_TRIP_STATUSES.includes(trip.status)) {
    return false
  }

  // 1. CHUYẾN ĐI RIÊNG TƯ (PRIVATE TRIP)
  if (trip.tripType === 'PRIVATE') {
    const member = await tx.tripMember.findUnique({
      where: { tripId_userId: { tripId: order.tripId, userId: order.userId } },
      select: { id: true, status: true },
    })
    return (
      !!member &&
      member.status === 'ACTIVE' &&
      (!order.membershipRef || order.membershipRef === member.id)
    )
  }

  // 2. CHUYẾN ĐI CÔNG KHAI (PUBLIC TRIP) - LEADER
  if (trip.leaderId === order.userId) {
    return !order.membershipRef || order.membershipRef === trip.leaderId
  }

  // 3. CHUYẾN ĐI CÔNG KHAI (PUBLIC TRIP) - PARTICIPANT
  const participants = await tx.bookingParticipant.findMany({
    where: {
      userId: order.userId,
      booking: { tripId: order.tripId, ...(order.bookingId ? { id: order.bookingId } : {}) },
    },
    select: {
      id: true,
      bookingId: true,
      status: true,
      booking: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  })

  // Chỉ chấp nhận người tham gia ACTIVE nằm trong booking CONFIRMED hợp lệ
  const activeParticipants = participants.filter(
    (p) =>
      p.status === 'ACTIVE' &&
      VALID_PUBLIC_BOOKING_STATUSES.includes(p.booking.status) &&
      (!order.bookingId || p.bookingId === order.bookingId),
  )

  const participantMatches = activeParticipants.some(
    (p) =>
      !order.membershipRef ||
      order.membershipRef === p.id ||
      order.membershipRef === p.bookingId,
  )
  if (participantMatches) return true

  // A confirmed booking owner may rent even when the passenger rows have no userId.
  return (await confirmedPublicBookingOwnerId(tx, order)) !== null
}
