import { invalidatePublicBookingInvitations } from './public-invitation-projection'
import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { refundPercentAt } from './booking-policy'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B, PAYMENT_ERROR_CODES as E } from '../../shared/errors'
import { PaymentsPort } from '../payments/payments.port'
import { paymentHash } from '../payments/payment-utils'
import { databaseTime, expireTripHolds, syncTripRegistrationState } from './booking-capacity'

@Injectable()
export class BookingCancellationService {
  private running = false
  private readonly logger = new Logger(BookingCancellationService.name)
  constructor(
    private readonly db: PrismaService,
    private readonly payments: PaymentsPort,
  ) {}

  private async rentalBlockers(tx: Prisma.TransactionClient, bookingId: string, actorId: string) {
    const participants = await tx.bookingParticipant.findMany({ where: { bookingId }, select: { id: true } })
    const orders = await tx.rentalOrder.findMany({
      where: {
        OR: [
          { bookingId },
          { membershipKind: 'PUBLIC_BOOKING_BUYER', membershipRef: bookingId },
          { membershipKind: 'PUBLIC_PARTICIPANT', membershipRef: { in: participants.map(p => p.id) } },
          { recipientParticipantId: { in: participants.map(p => p.id) } },
        ],
        status: { notIn: ['CANCELLED', 'EXPIRED', 'COMPLETED'] },
      },
      select: { id: true, status: true, userId: true },
      orderBy: { id: 'asc' },
    })
    // Do not disclose or offer access to another participant's rental order.
    return orders.map(o => ({
      orderId: o.userId === actorId ? o.id : null,
      status: o.status,
      ownedByViewer: o.userId === actorId,
    }))
  }

  async preview(bookingId: string, actorId: string) {
    return this.db.$transaction(async tx => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { trip: true } })
      if (!booking) throw AppError.fromCode(B.NOT_FOUND)
      if (booking.userId !== actorId) throw AppError.fromCode('FORBIDDEN')
      if (booking.trip.status === 'CANCELLED') throw AppError.fromCode(B.TRIP_CANCELLATION_PROCESSING)
      const now = await databaseTime(tx)
      if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status) || booking.trip.startAt <= now)
        throw AppError.fromCode(B.BOOKING_CANCELLATION_NOT_ALLOWED)
      if (booking.status === 'PENDING_PAYMENT' && booking.expiresAt <= now)
        throw AppError.fromCode(B.BOOKING_HOLD_EXPIRED)
      const rentals = await this.rentalBlockers(tx, bookingId, actorId)
      let refundableAmount = '0'
      if (booking.status === 'CONFIRMED') {
        const percent = refundPercentAt(booking.policySnapshot, booking.trip.startAt, now)
        if (percent === null) throw AppError.fromCode(B.BOOKING_CANCELLATION_POLICY_INVALID)
        const applied = await tx.paymentApplication.findFirst({
          where: { status: 'APPLIED', invoice: { bookingId } }, include: { payment: true },
        })
        if (!applied) throw AppError.fromCode(B.BOOKING_CANCELLATION_NOT_ALLOWED)
        const reserved = await tx.refund.aggregate({
          where: { paymentId: applied.paymentId, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
          _sum: { amount: true },
        })
        refundableAmount = Prisma.Decimal.max(0, applied.payment.amount.mul(percent).div(100).floor()
          .minus(reserved._sum.amount ?? 0)).toFixed()
      }
      return { canCancel: rentals.length === 0, rentals, refundableAmount, currency: 'VND', tripCancellationPending: booking.trip.status === 'CANCEL_PENDING' }
    })
  }

  async cancel(input: {
    bookingId: string
    actorId: string
    actorRole: string
    idempotencyKey: string
    reason: string
    tripCancellationRequestId?: string
  }) {
    const key = paymentHash([input.actorId, 'booking-cancellation', input.idempotencyKey])
    const requestHash = paymentHash({ bookingId: input.bookingId, reason: input.reason })
    const cancellation = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`
      const initial = await tx.booking.findUnique({ where: { id: input.bookingId } })
      if (!initial) throw AppError.fromCode(B.NOT_FOUND)
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${initial.tripId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${input.bookingId}::uuid FOR UPDATE`
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: input.bookingId }, include: { trip: true } })
      if (booking.tripId !== initial.tripId) throw AppError.fromCode(B.BOOKING_CANCELLATION_NOT_ALLOWED)
      const approvedRequest = input.tripCancellationRequestId ? await tx.tripCancellationRequest.findUnique({ where: { id: input.tripCancellationRequestId } }) : null
      if (input.tripCancellationRequestId && (!approvedRequest || approvedRequest.tripId !== booking.tripId || approvedRequest.status !== 'APPROVED' || approvedRequest.reviewedBy !== input.actorId || booking.trip.status !== 'CANCELLED'))
        throw AppError.fromCode('FORBIDDEN')
      const source = approvedRequest ? 'ORGANIZER' :
        input.actorRole === 'ADMIN'
          ? 'ADMIN'
          : input.actorId === booking.trip.creatorId && booking.trip.status === 'CANCELLED'
            ? 'ORGANIZER'
            : input.actorId === booking.userId
              ? 'USER'
              : null
      if (!source) throw AppError.fromCode('FORBIDDEN')
      const existing = await tx.bookingCancellation.findUnique({ where: { idempotencyKey: key } })
      if (existing) {
        const saved = existing.policySnapshot as Prisma.JsonObject
        const decision = saved.decision as Prisma.JsonObject | undefined
        if (existing.bookingId !== booking.id || decision?.requestHash !== requestHash)
          throw AppError.fromCode(E.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return existing
      }
      if (source === 'USER' && booking.trip.status === 'CANCELLED') throw AppError.fromCode(B.TRIP_CANCELLATION_PROCESSING)
      if (source === 'USER' && ['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) {
        // Trip lock is shared with rental createOrder/lockAndRead: no new order can slip past this guard.
        const rentals = await this.rentalBlockers(tx, booking.id, input.actorId)
        if (rentals.length) throw AppError.fromCode(B.RELATED_RENTALS_REQUIRE_RESOLUTION, { details: { rentals } })
      }
      if (booking.status === 'PENDING_PAYMENT') {
        const now = await databaseTime(tx)
        if (source === 'USER' && booking.expiresAt <= now) {
          await expireTripHolds(tx, booking.tripId, now)
          return null
        }
        if (source === 'USER' && booking.trip.startAt <= now) throw AppError.fromCode(B.BOOKING_CANCELLATION_NOT_ALLOWED)
        const record = await tx.bookingCancellation.create({
          data: {
            bookingId: booking.id,
            tripCancellationRequestId: approvedRequest?.id,
            source,
            idempotencyKey: key,
            cancelledBy: input.actorId,
            reason: input.reason,
            refundableAmount: 0,
            cancelledAt: now,
            policySnapshot: { original: booking.policySnapshot, decision: { requestHash, source, unpaidHold: true } },
          },
        })
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CANCELLED', cancelledAt: now, version: { increment: 1 } },
        })
        await invalidatePublicBookingInvitations(tx, booking, input.actorId, now)
        await tx.bookingParticipant.updateMany({
          where: { bookingId: booking.id, status: 'ACTIVE' },
          data: { status: 'CANCELLED' },
        })
        await tx.invoice.updateMany({
          where: { bookingId: booking.id, status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
          data: { status: 'CANCELLED', version: { increment: 1 } },
        })
        await syncTripRegistrationState(tx, booking.tripId, now)
        // Any unresolved collection remains financial truth; a later success is reversed by the payment consumer.
        await tx.bookingOutboxEvent.create({
          data: {
            deduplicationKey: `booking-cancellation:${record.id}:v1`,
            eventType: 'BOOKING_CANCELLED',
            aggregateType: 'Booking',
            aggregateId: booking.id,
            payload: {
              schemaVersion: 1,
              cancellationId: record.id,
              version: booking.version + 1,
              effectiveAt: now.toISOString(),
              reason: input.reason,
              bookingVersion: booking.version + 1,
              bookingId: booking.id,
              tripId: booking.tripId,
              userId: booking.userId,
              cancelSource: source,
              cancelledAt: now.toISOString(),
            },
          },
        })
        return record
      }
      const applied = await tx.paymentApplication.findFirst({
        where: { status: 'APPLIED', invoice: { bookingId: booking.id } },
        include: { payment: true },
      })
      if (!applied || booking.status !== 'CONFIRMED') throw AppError.fromCode(B.BOOKING_CANCELLATION_NOT_ALLOWED)
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${applied.invoiceId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${applied.paymentId}::uuid FOR UPDATE`
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: applied.paymentId } })
      if (
        payment.status !== 'SUCCEEDED' ||
        payment.reconcileStatus === 'NEEDS_REVIEW' ||
        payment.currency !== 'VND' ||
        (await tx.refund.findFirst({ where: { paymentId: payment.id, reconcileStatus: 'NEEDS_REVIEW' } }))
      )
        throw AppError.fromCode(B.BOOKING_CANCELLATION_NOT_ALLOWED)
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      let percent = 100
      if (source === 'USER') {
        if (booking.trip.startAt <= now) throw AppError.fromCode(B.BOOKING_CANCELLATION_NOT_ALLOWED)
        const evaluated = refundPercentAt(booking.policySnapshot, booking.trip.startAt, now)
        if (evaluated === null) throw AppError.fromCode(B.BOOKING_CANCELLATION_POLICY_INVALID)
        percent = evaluated
      }
      const reserved = await tx.refund.aggregate({
        where: { paymentId: payment.id, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } },
        _sum: { amount: true },
      })
      const refundableAmount = Prisma.Decimal.max(
        0,
        payment.amount
          .mul(percent.toString())
          .div(100)
          .floor()
          .minus(reserved._sum.amount ?? 0),
      )
      const record = await tx.bookingCancellation.create({
        data: {
          bookingId: booking.id,
          tripCancellationRequestId: approvedRequest?.id,
          source,
          idempotencyKey: key,
          cancelledBy: input.actorId,
          reason: input.reason,
          refundableAmount,
          cancelledAt: now,
          policySnapshot: {
            original: booking.policySnapshot,
            decision: {
              requestHash,
              source,
              percent,
              paymentId: payment.id,
              collectedAmount: payment.amount.toFixed(),
              refundableAmount: refundableAmount.toFixed(),
            },
          },
        },
      })
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED', cancelledAt: now, version: { increment: 1 } },
      })
      await tx.bookingParticipant.updateMany({
        where: { bookingId: booking.id, status: 'ACTIVE' },
        data: { status: 'CANCELLED' },
      })
      await invalidatePublicBookingInvitations(tx, booking, input.actorId, now)
      await syncTripRegistrationState(tx, booking.tripId, now)
      await tx.bookingOutboxEvent.create({
        data: {
          deduplicationKey: `booking-cancellation:${record.id}:v1`,
          eventType: 'BOOKING_CANCELLED',
          aggregateType: 'Booking',
          aggregateId: booking.id,
          payload: {
            schemaVersion: 1,
            cancellationId: record.id,
            version: booking.version + 1,
            effectiveAt: now.toISOString(),
            reason: input.reason,
            bookingVersion: booking.version + 1,
            bookingId: booking.id,
            paymentId: payment.id,
            tripId: booking.tripId,
            userId: booking.userId,
            cancelSource: source,
            cancelledAt: now.toISOString(),
          },
        },
      })
      return record
    })
    if (!cancellation) throw AppError.fromCode(B.BOOKING_HOLD_EXPIRED)
    return {
      bookingId: cancellation.bookingId,
      cancellationId: cancellation.id,
      status: 'CANCELLED',
      refundableAmount: cancellation.refundableAmount.toFixed(),
      currency: 'VND',
    }
  }

  async dispatch(cancellationId: string) {
    const cancellation = await this.db.bookingCancellation.findUniqueOrThrow({ where: { id: cancellationId } })
    const decision = (cancellation.policySnapshot as Prisma.JsonObject).decision as Prisma.JsonObject | undefined
    if (!decision || (typeof decision.paymentId !== 'string' && decision.unpaidHold !== true))
      throw AppError.fromCode(E.REFUND_SOURCE_INVALID)
    const refund = cancellation.refundableAmount.isZero()
      ? null
      : await this.payments.requestRefund({
          paymentId: decision.paymentId as string,
          businessActionId: `booking-cancellation:${cancellation.id}`,
          purpose: 'BOOKING_CANCELLATION',
          amount: cancellation.refundableAmount.toFixed(),
          idempotencyKey: `booking-cancellation:${cancellation.id}`,
          source: { bookingCancellationId: cancellation.id },
        })
    await this.db.bookingOutboxEvent.updateMany({
      where: { deduplicationKey: `booking-cancellation:${cancellation.id}:v1`, status: 'PENDING' },
      data: { status: 'PROCESSED', processedAt: new Date(), lastError: null },
    })
    return refund
  }

  @Interval(2000)
  async tick() {
    if (this.running || process.env.PAYMENT_EVENTS_WORKER_ENABLED === 'false') return
    this.running = true
    try {
      const events = await this.db.bookingOutboxEvent.findMany({
        where: { eventType: 'BOOKING_CANCELLED', status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 25,
      })
      for (const event of events) {
        try {
          const payload = event.payload as Prisma.JsonObject
          if (typeof payload.cancellationId !== 'string') throw new Error('Invalid cancellation event')
          await this.dispatch(payload.cancellationId)
        } catch {
          await this.db.bookingOutboxEvent.updateMany({
            where: { id: event.id, status: 'PENDING', retryCount: event.retryCount },
            data: {
              retryCount: { increment: 1 },
              status: event.retryCount >= 7 ? 'FAILED' : 'PENDING',
              lastError: 'REFUND_RESERVATION_DEFERRED',
            },
          })
          this.logger.warn(`Booking refund reservation deferred: ${event.id}`)
        }
      }
    } catch {
      this.logger.warn('Booking cancellation outbox unavailable; retrying on next tick')
    } finally {
      this.running = false
    }
  }
}
