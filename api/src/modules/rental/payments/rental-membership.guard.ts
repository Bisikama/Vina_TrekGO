import type { Prisma } from '@prisma/client'
import { confirmedPublicBookingOwnerId, VALID_PUBLIC_BOOKING_STATUSES } from '../shared/public-booking-membership'

export const INACTIVE_TRIP_STATUSES = ['DRAFT', 'CANCEL_PENDING', 'CANCELLED', 'INTERRUPTED', 'COMPLETED']

export interface OrderPaymentMembershipCheckInput {
  userId: string
  tripId: string
  membershipKind?: string | null
  membershipRef: string | null
  membershipSourceVersion?: number | null
  bookingId?: string | null
  status?: string
}

/** Single unified payment-time membership validation helper.
 * Used by RentalMembershipGuard, RentalCheckoutService, RentalPaymentConsumer, and PrismaRentalOrderAdapter.
 * Enforces exact {kind, ref, sourceVersion} matching for orders with membership sources.
 * Controlled fallback to bookingId is strictly restricted to LEGACY orders.
 */
export async function validateRentalOrderPaymentMembershipWithTx(
  tx: Prisma.TransactionClient,
  order: OrderPaymentMembershipCheckInput,
): Promise<boolean> {
  const trip = await tx.trip.findUnique({
    where: { id: order.tripId },
    select: { id: true, status: true, tripType: true, leaderId: true, version: true },
  })
  if (!trip || INACTIVE_TRIP_STATUSES.includes(trip.status)) {
    return false
  }

  // 1. EXACT KIND: PRIVATE_TRIP_MEMBER
  if (order.membershipKind === 'PRIVATE_TRIP_MEMBER') {
    if (!order.membershipRef) return false
    const member = await tx.tripMember.findUnique({
      where: { id: order.membershipRef },
      select: { id: true, userId: true, tripId: true, status: true, version: true },
    })
    if (!member || member.userId !== order.userId || member.tripId !== order.tripId || member.status !== 'ACTIVE') {
      return false
    }
    if (order.membershipSourceVersion != null && member.version < order.membershipSourceVersion) {
      return false
    }
    return true
  }

  // 2. EXACT KIND: PUBLIC_TRIP_LEADER
  if (order.membershipKind === 'PUBLIC_TRIP_LEADER') {
    if (trip.leaderId !== order.userId) return false
    if (order.membershipRef && order.membershipRef !== trip.leaderId) return false
    return true
  }

  // 3. EXACT KIND: PUBLIC_PARTICIPANT
  if (order.membershipKind === 'PUBLIC_PARTICIPANT') {
    if (!order.membershipRef) return false
    const participant = await tx.bookingParticipant.findUnique({
      where: { id: order.membershipRef },
      include: {
        booking: { select: { id: true, tripId: true, status: true, version: true } },
      },
    })
    if (
      !participant ||
      participant.userId !== order.userId ||
      participant.booking.tripId !== order.tripId ||
      participant.status !== 'ACTIVE' ||
      !VALID_PUBLIC_BOOKING_STATUSES.includes(participant.booking.status)
    ) {
      return false
    }
    if (order.bookingId && participant.bookingId !== order.bookingId) {
      return false
    }
    if (order.membershipSourceVersion != null && participant.booking.version < order.membershipSourceVersion) {
      return false
    }
    return true
  }

  // 4. EXACT KIND: PUBLIC_BOOKING_BUYER
  if (order.membershipKind === 'PUBLIC_BOOKING_BUYER') {
    if (!order.membershipRef) return false
    const booking = await tx.booking.findUnique({
      where: { id: order.membershipRef },
      select: { id: true, tripId: true, userId: true, status: true, version: true },
    })
    if (
      !booking ||
      booking.userId !== order.userId ||
      booking.tripId !== order.tripId ||
      !VALID_PUBLIC_BOOKING_STATUSES.includes(booking.status)
    ) {
      return false
    }
    if (order.membershipSourceVersion != null && booking.version < order.membershipSourceVersion) {
      return false
    }
    return true
  }

  // 5. LEGACY ORDERS (when membershipKind is null or 'LEGACY')
  if (!order.membershipKind || order.membershipKind === 'LEGACY') {
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

    if (trip.leaderId === order.userId) {
      return !order.membershipRef || order.membershipRef === trip.leaderId
    }

    const participants = await tx.bookingParticipant.findMany({
      where: {
        userId: order.userId,
        booking: { tripId: order.tripId, ...(order.bookingId ? { id: order.bookingId } : {}) },
      },
      select: {
        id: true,
        bookingId: true,
        status: true,
        booking: { select: { id: true, status: true } },
      },
    })

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

    // Fallback booking ID ONLY for LEGACY
    return (await confirmedPublicBookingOwnerId(tx, order)) !== null
  }

  return false
}

export async function rentalMembershipValid(
  tx: Prisma.TransactionClient,
  order: OrderPaymentMembershipCheckInput,
): Promise<boolean> {
  return validateRentalOrderPaymentMembershipWithTx(tx, order)
}
