import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../shared/services/prisma.service'
import { AppError, BOOKING_ERROR_CODES as B, PAYMENT_ERROR_CODES as P } from '../../shared/errors'
import { paymentHash } from '../payments/payment-utils'
import { databaseTime, expireTripHolds, occupiedSeats } from './booking-capacity'
import type { BookingPage, CreateBookingInput, UpdateParticipantsInput } from './booking.dto'
import { refundPercentAt } from './booking-policy'
import { BookingPolicyService, lockBookingPolicy } from './booking-policy.service'

function fail(code: string, details?: Record<string, unknown>): never {
  throw AppError.fromCode(code, { details })
}
const pickupSelect = { id: true, name: true, address: true, latitude: true, longitude: true } as const
const detailInclude = {
  trip: { include: { tripTransportsViaTripId: { orderBy: { sequence: 'asc' as const } } } },
  pickupPoint: { select: pickupSelect },
  returnPoint: { select: pickupSelect },
  bookingParticipantsViaBookingId: {
    where: { status: 'ACTIVE' as const },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
  invoicesViaBookingId: {
    include: { paymentsViaInvoiceId: { include: { application: true, refundsViaPaymentId: true } } },
  },
} satisfies Prisma.BookingInclude

@Injectable()
export class BookingsService {
  private running = false
  private readonly logger = new Logger(BookingsService.name)
  constructor(private readonly db: PrismaService, private readonly policies: BookingPolicyService) {}

  async create(tripId: string, userId: string, key: string, input: CreateBookingInput) {
    if (!userId) fail('UNAUTHENTICATED')
    const replayKey = paymentHash([userId, 'create-booking', key])
    const requestHash = paymentHash({ tripId, ...input })
    const id = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${replayKey}, 0))::text`
      const existing = await tx.booking.findUnique({ where: { createIdempotencyKey: replayKey } })
      if (existing) {
        if (existing.createRequestHash !== requestHash) fail(P.IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD)
        return existing.id
      }
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
      const trip = await tx.trip.findUnique({ where: { id: tripId } })
      if (!trip || trip.tripType !== 'PUBLIC' || !trip.publishedAt) fail(B.NOT_FOUND)
      await lockBookingPolicy(tx)
      const now = await databaseTime(tx)
      await expireTripHolds(tx, tripId, now)
      if (trip.status !== 'OPEN' || trip.startAt <= now) fail(B.INVALID_STATE_TRANSITION)
      const active = await tx.booking.findFirst({
        where: { tripId, userId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN'] } },
      })
      if (active) fail(B.ACTIVE_BOOKING_EXISTS, { bookingId: active.id })
      const remaining = trip.maxPax - (await occupiedSeats(tx, tripId, now))
      if (input.participantCount > remaining) fail(B.CAPACITY_CONFLICT, { remainingSlots: Math.max(0, remaining) })
      const policy = await this.policies.resolve(tx, now)
      if (!trip.pickupPointId || !trip.pricePerPax?.isPositive() || !trip.pricePerPax.isInteger())
        fail(B.INVALID_STATE_TRANSITION)
      const total = trip.pricePerPax.mul(input.participantCount)
      if (total.gt('9999999999')) fail(B.INVALID_STATE_TRANSITION)
      const expiresAt = new Date(Math.min(now.getTime() + policy.holdTtlMinutes * 60_000, trip.startAt.getTime()))
      const booking = await tx.booking.create({
        data: {
          tripId,
          userId,
          pickupPointId: trip.pickupPointId,
          returnPointId: trip.pickupPointId,
          bookingPolicyId: policy.id,
          participantCount: input.participantCount,
          pricePerPaxSnapshot: trip.pricePerPax,
          subtotalAmount: total,
          totalAmount: total,
          expiresAt,
          createIdempotencyKey: replayKey,
          createRequestHash: requestHash,
          policySnapshot: {
            policyCode: policy.policyCode,
            versionNo: policy.versionNo,
            holdTtlMinutes: policy.holdTtlMinutes,
            cancellationRules: policy.cancellationRules,
          },
        },
      })
      await tx.bookingParticipant.createMany({
        data: input.participants.map((p) => ({
          ...p,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : undefined,
          bookingId: booking.id,
          checkinCode: randomUUID(),
        })),
      })
      await this.invoice(tx, booking, 1)
      return booking.id
    })
    return this.detail(id, userId)
  }

  private async invoice(
    tx: Prisma.TransactionClient,
    booking: {
      id: string
      userId: string
      expiresAt: Date
      subtotalAmount: Prisma.Decimal
      totalAmount: Prisma.Decimal
      participantCount: number
      pricePerPaxSnapshot: Prisma.Decimal
    },
    revisionNo: number,
    supersedesInvoiceId?: string,
  ) {
    return tx.invoice.create({
      data: {
        invoiceNo: `BK-${randomUUID()}`,
        invoiceType: 'BOOKING',
        status: 'PENDING_PAYMENT',
        bookingId: booking.id,
        userId: booking.userId,
        expiresAt: booking.expiresAt,
        subtotalAmount: booking.subtotalAmount,
        totalAmount: booking.totalAmount,
        revisionNo,
        supersedesInvoiceId,
        invoiceLinesViaInvoiceId: {
          create: {
            lineCode: 'TRIP',
            description: 'Public trip participation',
            quantity: booking.participantCount,
            unitAmount: booking.pricePerPaxSnapshot,
            lineAmount: booking.subtotalAmount,
            referenceType: 'Booking',
            referenceId: booking.id,
          },
        },
      },
    })
  }

  async updateParticipants(id: string, userId: string, input: UpdateParticipantsInput) {
    if (!userId) fail('UNAUTHENTICATED')
    const result = await this.db.$transaction(async (tx) => {
      const initial = await tx.booking.findUnique({ where: { id } })
      if (!initial) fail(B.NOT_FOUND)
      if (initial.userId !== userId) fail('FORBIDDEN')
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${initial.tripId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${id}::uuid FOR UPDATE`
      const now = await databaseTime(tx)
      await expireTripHolds(tx, initial.tripId, now)
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: { trip: true, bookingParticipantsViaBookingId: true },
      })
      if (booking.status === 'EXPIRED') return B.BOOKING_HOLD_EXPIRED
      if (
        booking.status !== 'PENDING_PAYMENT' ||
        !['OPEN', 'FULL'].includes(booking.trip.status) ||
        booking.trip.startAt <= now
      )
        fail(B.INVALID_STATE_TRANSITION)
      if (booking.version !== input.expectedVersion) fail(B.BOOKING_VERSION_CONFLICT)
      // Legacy fee/discount obligations require a pricing policy, not an implicit rewrite.
      if (!booking.insuranceAmount.isZero() || !booking.discountAmount.isZero()) fail(B.INVALID_STATE_TRANSITION)
      // Never mutate an obligation while a provider could still collect it.
      if (
        await tx.payment.findFirst({
          where: {
            invoice: { bookingId: id },
            OR: [{ status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } }, { reconcileStatus: 'NEEDS_REVIEW' }],
          },
        })
      )
        fail(P.PAYMENT_ATTEMPT_IN_PROGRESS)
      if (
        input.participants.some(
          (p) =>
            p.id && !booking.bookingParticipantsViaBookingId.some((old) => old.id === p.id && old.status === 'ACTIVE'),
        )
      )
        fail('VALIDATION_ERROR')
      const remaining = booking.trip.maxPax - (await occupiedSeats(tx, booking.tripId, now, id))
      if (input.participantCount > remaining) fail(B.CAPACITY_CONFLICT, { remainingSlots: Math.max(0, remaining) })
      const keep = input.participants.flatMap((p) => (p.id ? [p.id] : []))
      await tx.bookingParticipant.updateMany({
        where: { bookingId: id, status: 'ACTIVE', id: { notIn: keep } },
        data: { status: 'CANCELLED' },
      })
      for (const p of input.participants) {
        const data = {
          fullName: p.fullName,
          phone: p.phone ?? null,
          dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth) : null,
          emergencyContactName: p.emergencyContactName ?? null,
          emergencyContactPhone: p.emergencyContactPhone ?? null,
        }
        if (p.id) await tx.bookingParticipant.update({ where: { id: p.id }, data })
        else await tx.bookingParticipant.create({ data: { ...data, bookingId: id, checkinCode: randomUUID() } })
      }
      const total = booking.pricePerPaxSnapshot.mul(input.participantCount)
      if (total.gt('9999999999')) fail(B.INVALID_STATE_TRANSITION)
      const updated = await tx.booking.update({
        where: { id },
        data: {
          participantCount: input.participantCount,
          subtotalAmount: total,
          totalAmount: total,
          discountAmount: 0,
          insuranceAmount: 0,
          version: { increment: 1 },
        },
      })
      const oldInvoice = await tx.invoice.findFirst({
        where: { bookingId: id },
        orderBy: [{ revisionNo: 'desc' }, { createdAt: 'desc' }],
      })
      await tx.invoice.updateMany({
        where: { bookingId: id, status: { in: ['DRAFT', 'PENDING_PAYMENT'] } },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      })
      await this.invoice(
        tx,
        updated,
        (oldInvoice?.revisionNo ?? 0) + 1,
        oldInvoice?.revisionNo ? oldInvoice.id : undefined,
      )
      return null
    })
    if (result) fail(result)
    return this.detail(id, userId)
  }

  async detail(id: string, userId: string) {
    if (!userId) fail('UNAUTHENTICATED')
    const initial = await this.db.booking.findUnique({ where: { id } })
    // Keep the existing detail contract: inaccessible bookings are not found.
    if (!initial || initial.userId !== userId) fail(B.NOT_FOUND)
    await this.expire(initial.tripId)
    const booking = await this.db.booking.findUniqueOrThrow({ where: { id }, include: detailInclude })
    const payments = booking.invoicesViaBookingId
      .flatMap((i) => i.paymentsViaInvoiceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    const payment = payments.find((p) => p.application?.status === 'APPLIED') ?? payments[0]
    const confirmed = ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'].includes(booking.status)
    const now = new Date()
    const hoursBeforeStart = (booking.trip.startAt.getTime() - now.getTime()) / 3600000
    const canCancel =
      hoursBeforeStart > 0 &&
      (booking.status === 'PENDING_PAYMENT' ||
        (booking.status === 'CONFIRMED' &&
          payment?.application?.status === 'APPLIED' &&
          payment.status === 'SUCCEEDED' &&
          payment.reconcileStatus !== 'NEEDS_REVIEW' &&
          !payment.refundsViaPaymentId.some((r) => r.reconcileStatus === 'NEEDS_REVIEW') &&
          refundPercentAt(booking.policySnapshot, booking.trip.startAt, now) !== null))
    const editable =
      booking.status === 'PENDING_PAYMENT' &&
      ['OPEN', 'FULL'].includes(booking.trip.status) &&
      booking.trip.startAt > new Date() &&
      booking.insuranceAmount.isZero() &&
      booking.discountAmount.isZero() &&
      !payments.some(
        (p) => ['PENDING', 'PROCESSING', 'SUCCEEDED'].includes(p.status) || p.reconcileStatus === 'NEEDS_REVIEW',
      )
    return {
      id: booking.id,
      status: booking.status,
      version: booking.version,
      participantCount: booking.participantCount,
      expiresAt: booking.expiresAt.toISOString(),
      confirmedAt: booking.confirmedAt?.toISOString() ?? null,
      pricePerPax: booking.pricePerPaxSnapshot.toFixed(),
      totalAmount: booking.totalAmount.toFixed(),
      currency: booking.currency,
      canEditParticipants: editable,
      canCancel,
      rentalEligible: booking.status === 'CONFIRMED' && booking.trip.tripType === 'PUBLIC',
      trip: {
        id: booking.trip.id,
        title: booking.trip.title,
        startAt: booking.trip.startAt,
        endAt: booking.trip.endAt,
        status: booking.trip.status,
      },
      pickup: booking.pickupPoint,
      returnPoint: booking.returnPoint,
      participants: booking.bookingParticipantsViaBookingId.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        phone: p.phone,
        dateOfBirth: p.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        emergencyContactName: p.emergencyContactName,
        emergencyContactPhone: p.emergencyContactPhone,
      })),
      transport: booking.trip.tripTransportsViaTripId
        .filter((t) => t.status !== 'CANCELLED')
        .map((t) => ({
          vehicleType: t.vehicleType,
          ...(confirmed
            ? {
                plateNumber: t.plateNumber,
                driverName: t.driverName,
                driverPhone: t.driverPhone,
                meetingAt: t.meetingAt,
              }
            : {}),
        })),
      paymentSummary: payment
        ? {
            paymentId: payment.id,
            status: payment.status,
            applicationStatus: payment.application?.status ?? null,
            applicationReasonCode: payment.application?.reasonCode ?? null,
            reconciliationRequired: ['SCHEDULED', 'RUNNING', 'NEEDS_REVIEW'].includes(payment.reconcileStatus),
            checkout: payment.checkoutData,
            providerEnvironment: payment.providerEnvironment,
          }
        : null,
      refunds: payments.flatMap((p) =>
        p.refundsViaPaymentId.map((r) => ({
          refundId: r.id,
          paymentId: p.id,
          purpose: r.purpose,
          reasonCode: r.reasonCode,
          amount: r.amount.toFixed(),
          currency: r.currency,
          status: r.status,
          refundedAt: r.refundedAt?.toISOString() ?? null,
          reconciliationRequired: ['SCHEDULED', 'RUNNING', 'NEEDS_REVIEW'].includes(r.reconcileStatus),
        })),
      ),
    }
  }

  async list(userId: string, query: BookingPage) {
    if (!userId) fail('UNAUTHENTICATED')
    const holds = await this.db.booking.findMany({
      where: { userId, status: 'PENDING_PAYMENT' },
      select: { tripId: true },
      distinct: ['tripId'],
    })
    for (const hold of holds) await this.expire(hold.tripId)
    const where: Prisma.BookingWhereInput = { userId, ...(query.status ? { status: query.status } : {}) }
    const [total, rows] = await this.db.$transaction([
      this.db.booking.count({ where }),
      this.db.booking.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { trip: { select: { id: true, title: true, startAt: true, endAt: true } } },
      }),
    ])
    return {
      items: rows.map((b) => ({
        id: b.id,
        status: b.status,
        participantCount: b.participantCount,
        totalAmount: b.totalAmount.toFixed(),
        currency: b.currency,
        expiresAt: b.expiresAt,
        trip: b.trip,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async rentalContext(id: string) {
    const booking = await this.db.booking.findUnique({
      where: { id },
      include: { trip: true, pickupPoint: { select: pickupSelect }, returnPoint: { select: pickupSelect } },
    })
    if (!booking) fail(B.NOT_FOUND)
    if (booking.status !== 'CONFIRMED' || booking.trip.tripType !== 'PUBLIC') fail(B.INVALID_STATE_TRANSITION)
    return {
      bookingId: id,
      userId: booking.userId,
      tripId: booking.tripId,
      status: booking.status,
      startAt: booking.trip.startAt,
      endAt: booking.trip.endAt,
      pickup: booking.pickupPoint,
      returnPoint: booking.returnPoint,
      participantCount: booking.participantCount,
    }
  }

  async expire(tripId: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
      return expireTripHolds(tx, tripId, await databaseTime(tx))
    })
  }

  @Interval(5000)
  async expireTick() {
    if (this.running || process.env.BOOKING_EXPIRY_WORKER_ENABLED === 'false') return
    this.running = true
    try {
      const rows = await this.db.booking.findMany({
        where: { status: 'PENDING_PAYMENT', expiresAt: { lte: new Date() } },
        select: { tripId: true },
        distinct: ['tripId'],
        take: 100,
      })
      for (const row of rows) await this.expire(row.tripId)
    } catch {
      this.logger.warn('Booking expiry deferred; retrying next tick')
    } finally {
      this.running = false
    }
  }
}
