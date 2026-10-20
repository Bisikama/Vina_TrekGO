import { BookingStatus, type Prisma } from '@prisma/client'

export const VALID_PUBLIC_BOOKING_STATUSES: BookingStatus[] = [
  'CONFIRMED',
  'PARTIAL_CHECKIN',
  'CHECKED_IN',
  'COMPLETED',
]

/** The booking owner may rent under the confirmed booking, including when booking for others. */
export async function confirmedPublicBookingOwnerId(
  tx: Prisma.TransactionClient,
  order: { tripId: string; userId: string; bookingId?: string | null; membershipRef: string | null },
): Promise<string | null> {
  const bookingId = order.bookingId ?? order.membershipRef
  if (!bookingId || (order.membershipRef && order.membershipRef !== bookingId)) return null
  const booking = await tx.booking.findFirst({
    where: {
      id: bookingId,
      tripId: order.tripId,
      userId: order.userId,
      status: { in: VALID_PUBLIC_BOOKING_STATUSES },
    },
    select: { id: true },
  })
  return booking?.id ?? null
}
