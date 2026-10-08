import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../shared/services/prisma.service'

const CONSUMER = 'booking-payment-application-v1'

@Injectable()
export class BookingPaymentConsumer {
  constructor(private readonly db: PrismaService) {}

  async consume(eventId: string) {
    await this.db.$transaction(async (tx) => {
      const initialEvent = await tx.paymentOutboxEvent.findUnique({ where: { id: eventId } })
      if (!initialEvent || initialEvent.eventType !== 'PAYMENT_SUCCEEDED' || initialEvent.aggregateType !== 'Payment')
        return
      const initial = await tx.payment.findUnique({
        where: { id: initialEvent.aggregateId },
        include: { invoice: { include: { booking: true } } },
      })
      if (!initial || initial.invoice.invoiceType !== 'BOOKING' || !initial.invoice.booking) return
      const source = initial.invoice.booking
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${source.tripId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${source.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${initial.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${initial.id}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payment_applications WHERE payment_id = ${initial.id}::uuid FOR UPDATE`
      const claimed = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM payment_outbox_events WHERE id = ${eventId}::uuid
        AND status = 'PENDING' AND (next_retry_at IS NULL OR next_retry_at <= clock_timestamp()) FOR UPDATE SKIP LOCKED`
      if (!claimed.length) return
      const event = await tx.paymentOutboxEvent.findUniqueOrThrow({ where: { id: eventId } })
      const receipt = await tx.paymentConsumerReceipt.findUnique({
        where: { eventId_consumerName: { eventId, consumerName: CONSUMER } },
      })
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: initial.id },
        include: { invoice: true, application: true },
      })
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: source.id }, include: { trip: true } })
      const payload = event.payload as Record<string, unknown>
      if (
        payment.invoiceId !== initial.invoiceId ||
        payment.invoice.bookingId !== booking.id ||
        booking.tripId !== source.tripId ||
        payload.schemaVersion !== 1 ||
        payload.paymentId !== payment.id ||
        payload.invoiceId !== payment.invoiceId ||
        payment.status !== 'SUCCEEDED' ||
        !payment.application ||
        payment.application.invoiceId !== payment.invoiceId
      )
        throw new Error('Invalid payment application mapping')
      if (payment.reconcileStatus === 'NEEDS_REVIEW') throw new Error('Payment requires review before application')
      let [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      if (!receipt && payment.application.status === 'PENDING') {
        const invoice = payment.invoice
        let reason: string | null = null
        const otherApplied = await tx.paymentApplication.findFirst({
          where: {
            status: 'APPLIED',
            paymentId: { not: payment.id },
            invoice: { bookingId: booking.id },
          },
        })
        if (otherApplied || booking.confirmationIdempotencyKey) reason = 'DUPLICATE_PAYMENT'
        else if (
          booking.expiresAt <= now ||
          booking.status === 'EXPIRED' ||
          (invoice.expiresAt && invoice.expiresAt <= now)
        )
          reason = 'LATE_PAYMENT'
        else if (
          booking.status !== 'PENDING_PAYMENT' ||
          booking.trip.tripType !== 'PUBLIC' ||
          !['OPEN', 'FULL'].includes(booking.trip.status) ||
          booking.trip.startAt <= now ||
          invoice.status !== 'PENDING_PAYMENT' ||
          invoice.invoiceType !== 'BOOKING' ||
          invoice.userId !== booking.userId ||
          invoice.currency !== booking.currency ||
          payment.currency !== invoice.currency ||
          !payment.amount.equals(invoice.totalAmount) ||
          !invoice.totalAmount.equals(booking.totalAmount) ||
          !invoice.subtotalAmount.equals(booking.subtotalAmount.plus(booking.insuranceAmount)) ||
          !invoice.discountAmount.equals(booking.discountAmount)
        )
          reason = 'DOMAIN_NOT_ELIGIBLE'
        if (!reason) {
          const participants = await tx.bookingParticipant.count({ where: { bookingId: booking.id, status: 'ACTIVE' } })
          const occupied = await tx.bookingParticipant.count({
            where: {
              status: 'ACTIVE',
              booking: {
                tripId: booking.tripId,
                OR: [
                  { status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN'] } },
                  { status: 'PENDING_PAYMENT', expiresAt: { gt: now } },
                ],
              },
            },
          })
          if (participants !== booking.participantCount || participants < 1 || occupied > booking.trip.maxPax)
            reason = 'DOMAIN_NOT_ELIGIBLE'
        }
        ;[{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
        if (!reason && (booking.expiresAt <= now || (invoice.expiresAt && invoice.expiresAt <= now)))
          reason = 'LATE_PAYMENT'
        if (!reason && booking.trip.startAt <= now) reason = 'DOMAIN_NOT_ELIGIBLE'
        if (reason) {
          await tx.paymentApplication.update({
            where: { paymentId: payment.id },
            data: {
              status: 'REJECTED',
              reasonCode: reason,
              decidedAt: now,
            },
          })
          // Durable handoff to the idempotent technical-reversal worker.
          await tx.paymentOutboxEvent.create({
            data: {
              deduplicationKey: `payment:${payment.id}:technical-reversal-requested:v1`,
              eventType: 'TECHNICAL_REVERSAL_REQUESTED',
              aggregateType: 'Payment',
              aggregateId: payment.id,
              payload: { schemaVersion: 1, paymentId: payment.id, invoiceId: invoice.id, reasonCode: reason },
            },
          })
        } else {
          const confirmationKey = `payment:${payment.id}`
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: 'CONFIRMED',
              confirmedAt: now,
              confirmationIdempotencyKey: confirmationKey,
              version: { increment: 1 },
            },
          })
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID', paidAt: payment.paidAt, version: { increment: 1 } },
          })
          await tx.paymentApplication.update({
            where: { paymentId: payment.id },
            data: { status: 'APPLIED', appliedAt: now, decidedAt: now },
          })
          await tx.bookingOutboxEvent.create({
            data: {
              deduplicationKey: `booking:${booking.id}:confirmed:v1`,
              eventType: 'BOOKING_CONFIRMED',
              aggregateType: 'Booking',
              aggregateId: booking.id,
              payload: {
                schemaVersion: 1,
                bookingId: booking.id,
                tripId: booking.tripId,
                userId: booking.userId,
                paymentId: payment.id,
                invoiceId: invoice.id,
                confirmationIdempotencyKey: confirmationKey,
                confirmedAt: now.toISOString(),
              },
            },
          })
        }
      }
      if (!receipt) await tx.paymentConsumerReceipt.create({ data: { eventId, consumerName: CONSUMER } })
      await tx.paymentOutboxEvent.update({
        where: { id: eventId },
        data: { status: 'PROCESSED', processedAt: now, lastError: null, nextRetryAt: null },
      })
    })
  }
}
