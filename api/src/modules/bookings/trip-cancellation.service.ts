import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { AppError, BOOKING_ERROR_CODES as B, PAYMENT_ERROR_CODES as P } from '../../shared/errors'
import { PrismaService } from '../../shared/services/prisma.service'
import {
  CancellationDeliveryService,
  type CancellationEvent,
  CANCELLATION_CONSUMERS,
} from '../../shared/services/cancellation-delivery.service'
import { BookingCancellationService } from './booking-cancellation.service'
import { databaseTime, effectiveRegistrationDeadline, occupiedSeats } from './booking-capacity'
import { paymentHash } from '../payments/payment-utils'

export type CancellationReview = { expectedTripVersion: number; expectedRequestVersion: number; note: string }
type Actor = { id: string; role: string }
@Injectable()
export class TripCancellationService {
  private running = false
  private readonly logger = new Logger(TripCancellationService.name)
  constructor(
    private readonly db: PrismaService,
    private readonly bookings: BookingCancellationService,
    private readonly deliveries: CancellationDeliveryService,
  ) {}
  async list(actor: Actor, page: number, pageSize: number, status?: string) {
    const where: Prisma.TripCancellationRequestWhereInput = {
      ...(actor.role === 'ADMIN' ? {} : { trip: { creatorId: actor.id } }),
      ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
    }
    const [items, total] = await Promise.all([
      this.db.tripCancellationRequest.findMany({
        where,
        include: { trip: { select: { id: true, title: true, version: true, status: true, startAt: true } } },
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.tripCancellationRequest.count({ where }),
    ])
    return { items, total, page, pageSize }
  }
  async detail(actor: Actor, id: string) {
    const request = await this.db.tripCancellationRequest.findUnique({ where: { id }, include: { trip: true } })
    if (!request) throw AppError.fromCode(B.NOT_FOUND)
    if (actor.role !== 'ADMIN' && request.trip.creatorId !== actor.id) throw AppError.fromCode('FORBIDDEN')
    const deliveries = await this.db.$queryRaw<
      {
        eventId: string
        eventType: string
        consumer: string | null
        status: string | null
        attempts: number | null
        lastError: string | null
        result: Prisma.JsonValue | null
      }[]
    >`
      SELECT e.id AS "eventId",e.event_type AS "eventType",d.consumer,d.status,d.attempts,d.last_error AS "lastError",i.result
      FROM booking_outbox_events e LEFT JOIN cancellation_deliveries d ON d.event_id=e.id
      LEFT JOIN rental_inbox_events i ON i.event_id::text=e.id::text
      WHERE e.payload->>'requestId'=${id} ORDER BY e.created_at,e.id`
    const [remainingBookings, actionRequiredRentals, refunds] = await Promise.all([
      this.db.booking.count({ where: { tripId: request.tripId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } } }),
      this.db.rentalOrder.count({ where: { tripId: request.tripId, exceptionStatus: 'ACTION_REQUIRED' } }),
      this.db.refund.groupBy({
        by: ['status'],
        where: {
          OR: [{ bookingCancellation: { tripCancellationRequestId: id } }, { rentalOrder: { tripId: request.tripId } }],
        },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ])
    const root = deliveries.filter((d) => d.eventType === 'TRIP_CANCELLED')
    const rootComplete = CANCELLATION_CONSUMERS.every((c) =>
      root.some((d) => d.consumer === c && d.status === 'COMPLETED'),
    )
    const failed = deliveries.some((d) => d.status === 'FAILED')
    const complete = rootComplete && remainingBookings === 0 && deliveries.every((d) => d.status === 'COMPLETED')
    const executionStatus =
      request.status === 'PENDING'
        ? 'PENDING_REVIEW'
        : request.status === 'REJECTED'
          ? 'REJECTED'
          : failed || actionRequiredRentals > 0
            ? 'ACTION_REQUIRED'
            : complete
              ? 'COMPLETED'
              : 'PROCESSING'
    return {
      ...request,
      executionStatus,
      remainingBookings,
      actionRequiredRentals,
      refunds,
      deliveries,
      workerEnabled: process.env.TRIP_CANCELLATION_WORKER_ENABLED === 'true',
    }
  }
  async review(actor: Actor, id: string, decision: 'APPROVED' | 'REJECTED', input: CancellationReview, key: string) {
    if (actor.role !== 'ADMIN') throw AppError.fromCode('FORBIDDEN')
    if (process.env.TRIP_CANCELLATION_WORKER_ENABLED !== 'true')
      throw AppError.fromCode(B.TRIP_CANCELLATION_REVIEW_DISABLED)
    const requestHash = paymentHash({ id, decision, ...input })
    const hashedKey = paymentHash([actor.id, 'trip-review', key])
    return this.db.$transaction(
      async (tx) => {
        if (!(await tx.user.findFirst({ where: { id: actor.id, role: 'ADMIN' }, select: { id: true } })))
          throw AppError.fromCode('FORBIDDEN')
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${hashedKey},0))::text`
        const cached = await tx.idempotencyRecord.findUnique({
          where: {
            scope_userId_idempotencyKey: {
              scope: 'trip-cancellation-review',
              userId: actor.id,
              idempotencyKey: hashedKey,
            },
          },
        })
        if (cached) {
          if (cached.requestHash !== requestHash)
            throw AppError.fromCode(P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
          return cached.responseBody
        }
        const initial = await tx.tripCancellationRequest.findUnique({ where: { id } })
        if (!initial) throw AppError.fromCode(B.NOT_FOUND)
        await tx.$queryRaw`SELECT id FROM trips WHERE id=${initial.tripId}::uuid FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM trip_cancellation_requests WHERE id=${id}::uuid FOR UPDATE`
        const request = await tx.tripCancellationRequest.findUniqueOrThrow({ where: { id }, include: { trip: true } })
        const trip = request.trip
        if (request.status !== 'PENDING' || trip.status !== 'CANCEL_PENDING')
          throw AppError.fromCode(B.TRIP_CANCELLATION_NOT_REVIEWABLE)
        if (request.version !== input.expectedRequestVersion || trip.version !== input.expectedTripVersion)
          throw AppError.fromCode(B.TRIP_CANCELLATION_VERSION_CONFLICT)
        const now = await databaseTime(tx)
        let nextStatus: 'CANCELLED' | 'DRAFT' | 'OPEN' | 'FULL' | 'CLOSED' = 'CANCELLED'
        if (decision === 'APPROVED') {
          const [checked, operated] = await Promise.all([
            tx.bookingParticipant.count({
              where: {
                booking: { tripId: trip.id },
                OR: [{ checkinStatus: 'CHECKED_IN' }, { checkedInAt: { not: null } }],
              },
            }),
            tx.booking.count({
              where: { tripId: trip.id, status: { in: ['PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'] } },
            }),
          ])
          if (trip.tripType !== 'PUBLIC' || trip.startedAt || trip.completedAt || checked || operated)
            throw AppError.fromCode(B.TRIP_CANCELLATION_NOT_REVIEWABLE)
        } else {
          if (!input.note.trim()) throw AppError.fromCode('VALIDATION_ERROR')
          const previous = request.previousTripStatus
          nextStatus =
            previous === 'DRAFT'
              ? 'DRAFT'
              : previous === 'CLOSED' || now >= trip.startAt || now >= effectiveRegistrationDeadline(trip)
                ? 'CLOSED'
                : (await occupiedSeats(tx, trip.id, now)) >= trip.maxPax
                  ? 'FULL'
                  : 'OPEN'
        }
        const updated = await tx.trip.update({
          where: { id: trip.id },
          data: {
            status: nextStatus,
            version: { increment: 1 },
            ...(decision === 'APPROVED' ? { cancelledAt: now } : {}),
          },
        })
        const reviewed = await tx.tripCancellationRequest.update({
          where: { id },
          data: {
            status: decision,
            reviewedBy: actor.id,
            reviewNote: input.note,
            reviewedAt: now,
            version: { increment: 1 },
          },
        })
        if (decision === 'APPROVED')
          await tx.bookingOutboxEvent.create({
            data: {
              deduplicationKey: `trip-cancellation:${id}:approved`,
              eventType: 'TRIP_CANCELLED',
              aggregateType: 'Trip',
              aggregateId: trip.id,
              payload: {
                schemaVersion: 1,
                requestId: id,
                tripId: trip.id,
                tripVersion: updated.version,
                version: updated.version,
                effectiveAt: now.toISOString(),
                cancelledAt: now.toISOString(),
                reason: request.reason,
                reviewedBy: actor.id,
              },
            },
          })
        const result = {
          id: reviewed.id,
          status: reviewed.status,
          version: reviewed.version,
          tripId: trip.id,
          tripVersion: updated.version,
          tripStatus: updated.status,
          executionStatus: decision === 'APPROVED' ? 'PROCESSING' : 'REJECTED',
        }
        await tx.idempotencyRecord.create({
          data: {
            scope: 'trip-cancellation-review',
            userId: actor.id,
            idempotencyKey: hashedKey,
            requestHash,
            responseStatus: decision === 'APPROVED' ? 202 : 200,
            responseBody: result,
            completedAt: now,
          },
        })
        return result
      },
      { timeout: 30000 },
    )
  }
  async handle(event: CancellationEvent) {
    const payload = event.payload as Prisma.JsonObject
    const requestId = String(payload.requestId ?? '')
    const request = await this.db.tripCancellationRequest.findUnique({ where: { id: requestId } })
    if (!request || request.status !== 'APPROVED' || request.tripId !== String(payload.tripId))
      throw AppError.fromCode(B.TRIP_CANCELLATION_NOT_REVIEWABLE)
    if (event.eventType === 'TRIP_CANCELLED') {
      // Fan out durable jobs in bounded transactions, not a single all-bookings cancellation transaction.
      let cursor: string | undefined
      for (;;) {
        const rows = await this.db.booking.findMany({
          where: { tripId: request.tripId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })
        if (!rows.length) break
        await this.db.bookingOutboxEvent.createMany({
          skipDuplicates: true,
          data: rows.map((row) => ({
            deduplicationKey: `trip-cancellation:${requestId}:booking:${row.id}`,
            eventType: 'TRIP_BOOKING_CANCELLATION',
            aggregateType: 'Booking',
            aggregateId: row.id,
            payload: { requestId, tripId: request.tripId, bookingId: row.id },
          })),
        })
        cursor = rows[rows.length - 1].id
      }
      return
    }
    const booking = await this.db.booking.findUnique({ where: { id: event.aggregateId } })
    if (!booking || booking.tripId !== request.tripId) throw AppError.fromCode(B.NOT_FOUND)
    // This status check is intentional: NEVER reopen or top up an earlier voluntary cancellation.
    if (['CANCELLED', 'EXPIRED'].includes(booking.status)) return
    if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.status))
      throw AppError.fromCode(B.TRIP_CANCELLATION_NOT_REVIEWABLE)
    await this.bookings.cancel({
      bookingId: booking.id,
      actorId: request.reviewedBy!,
      actorRole: 'ADMIN',
      idempotencyKey: `trip-cancel:${requestId}:${booking.id}`,
      reason: request.reason,
      tripCancellationRequestId: requestId,
    })
  }
  @Interval(2000)
  async tick() {
    if (this.running || process.env.TRIP_CANCELLATION_WORKER_ENABLED !== 'true') return
    this.running = true
    try {
      for (let i = 0; i < 4; i++)
        if (
          !(await this.deliveries.run('trip-bookings-v1', ['TRIP_CANCELLED', 'TRIP_BOOKING_CANCELLATION'], (e) =>
            this.handle(e),
          ))
        )
          break
    } catch {
      this.logger.warn('Trip cancellation worker unavailable; retrying on next tick')
    } finally {
      this.running = false
    }
  }
  async retry(actor: Actor, eventId: string, consumer: string, note: string) {
    if (actor.role !== 'ADMIN') throw AppError.fromCode('FORBIDDEN')
    if (!CANCELLATION_CONSUMERS.includes(consumer as (typeof CANCELLATION_CONSUMERS)[number]) || !note.trim())
      throw AppError.fromCode('VALIDATION_ERROR')
    const event = await this.db.bookingOutboxEvent.findUnique({ where: { id: eventId } })
    const allowed =
      consumer === 'trip-bookings-v1'
        ? ['TRIP_CANCELLED', 'TRIP_BOOKING_CANCELLATION']
        : [
            'TRIP_CANCELLED',
            'PRIVATE_TRIP_CANCELLED',
            'BOOKING_CANCELLED',
            'PRIVATE_TRIP_MEMBER_LEFT',
            'PRIVATE_TRIP_MEMBER_REMOVED',
            'PRIVATE_TRIP_MEMBER_JOINED',
            'PUBLIC_PARTICIPANT_CLAIMED',
          ]
    if (!event || !allowed.includes(event.eventType)) throw AppError.fromCode(B.TRIP_CANCELLATION_REPLAY_NOT_ALLOWED)
    await this.db.$transaction(async (tx) => {
      const changed = await tx.$queryRaw<
        { event_id: string }[]
      >`INSERT INTO cancellation_deliveries(event_id,consumer) VALUES(${eventId}::uuid,${consumer})
        ON CONFLICT(event_id,consumer) DO UPDATE SET status='PENDING',attempts=0,next_attempt_at=now(),lease_until=NULL,lease_owner=NULL,last_error=NULL
        WHERE cancellation_deliveries.status='FAILED' RETURNING event_id`
      if (!changed.length) throw AppError.fromCode(B.TRIP_CANCELLATION_REPLAY_NOT_ALLOWED)
      await tx.idempotencyRecord.create({
        data: {
          scope: 'trip-cancellation-replay-audit',
          userId: actor.id,
          idempotencyKey: paymentHash([eventId, consumer, Date.now(), note]),
          requestHash: paymentHash({ eventId, consumer, note }),
          responseBody: { eventId, consumer, note },
          completedAt: new Date(),
        },
      })
    })
    return { eventId, consumer, status: 'PENDING' }
  }
}
