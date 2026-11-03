jest.mock('@nestjs/schedule', () => ({ Interval: () => () => {} }))
import { randomUUID } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { REQUEST_USER_KEY } from '../../shared/constants/auth.constant'
import { AuthenticationGuard } from '../../shared/guards/authentication.guard'
import { RolesGuard } from '../../shared/guards/roles.guard'
import { GlobalErrorFilter } from '../../shared/errors'
import { PrismaService } from '../../shared/services/prisma.service'
import {
  CancellationDeliveryService,
  type CancellationEvent,
} from '../../shared/services/cancellation-delivery.service'
import { TripCancellationService } from './trip-cancellation.service'
import { AdminTripCancellationController } from './trip-cancellation.controller'
import { BookingCancellationService } from './booking-cancellation.service'
import { BookingPaymentConsumer } from './booking-payment.consumer'
import { RentalPaymentConsumer } from '../rental/payments/rental-payment.consumer'
import { TechnicalReversalWorker } from '../payments/technical-reversal.worker'
import { PaymentsPort } from '../payments/payments.port'
import { RefundsService } from '../payments/refunds.service'
import { RentalRefundsService } from '../payments/rental-refunds.service'
import { PrismaTripLifecycleAdapter } from '../rental/lifecycle/infrastructure/adapters/prisma-trip-lifecycle.adapter'
import { BookingMembershipEventConsumer } from '../rental/lifecycle/infrastructure/consumers/booking-membership-event.consumer'
import { HandleTripCancelledUseCase } from '../rental/lifecycle/application/use-cases/handle-trip-cancelled.use-case'
import { HandleBookingCancelledUseCase } from '../rental/lifecycle/application/use-cases/handle-booking-cancelled.use-case'
import { HandleMembershipSourceChangedUseCase } from '../rental/lifecycle/application/use-cases/handle-membership-source-changed.use-case'
import { PrismaRentalOrderAdapter } from '../rental/ordering/infrastructure/adapters/prisma-rental-order.adapter'
import type { RentalContextPort } from '../rental/ordering/application/ports/rental-context.port'
const url = process.env.TRIP_CANCELLATION_TEST_DATABASE_URL
if (url) {
  const parsed = new URL(url)
  if (
    !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
    !/^\/trek_cancel_test_[0-9a-f]{32}$/.test(parsed.pathname)
  )
    throw new Error('Disposable test database required')
}
const suite = url ? describe : describe.skip
suite('Trip cancellation: PostgreSQL business rules and durable workers', () => {
  const db = new PrismaClient({ datasourceUrl: url }),
    prism = db as unknown as PrismaService
  const refunds = new RefundsService(prism, {} as RentalRefundsService)
  const bookings = new BookingCancellationService(prism, {
    requestRefund: (input: Parameters<RefundsService['requestRefund']>[0]) => refunds.requestRefund(input),
  } as PaymentsPort)
  const deliveries = new CancellationDeliveryService(prism),
    service = new TripCancellationService(prism, bookings, deliveries)
  const lifecycle = new PrismaTripLifecycleAdapter(prism)
  const consumer = new BookingMembershipEventConsumer(
    prism,
    new HandleMembershipSourceChangedUseCase(lifecycle),
    new HandleBookingCancelledUseCase(lifecycle),
    new HandleTripCancelledUseCase(lifecycle),
    deliveries,
  )
  const rentals = new PrismaRentalOrderAdapter(prism, {} as RentalContextPort)
  let admin: { id: string; role: string }, leaderId: string, destinationId: string, pickupId: string, policyId: string
  beforeAll(async () => {
    process.env.TRIP_CANCELLATION_WORKER_ENABLED = 'true'
    admin = await db.user.create({
      data: { authUserId: randomUUID(), email: randomUUID() + '@test.local', fullName: 'Admin', role: 'ADMIN' },
    })
    leaderId = (
      await db.user.create({
        data: { authUserId: randomUUID(), email: randomUUID() + '@test.local', fullName: 'Leader', role: 'LEADER' },
      })
    ).id
    destinationId = (await db.destination.create({ data: { name: 'Test' } })).id
    pickupId = (
      await db.pickupPoint.create({
        data: { code: randomUUID(), name: 'Pickup', address: 'Test', latitude: 0, longitude: 0, createdBy: leaderId },
      })
    ).id
    policyId = (
      await db.bookingPolicy.create({
        data: {
          policyCode: randomUUID(),
          versionNo: 1,
          holdTtlMinutes: 15,
          cancellationRules: {},
          effectiveFrom: new Date(),
        },
      })
    ).id
    const location = await db.inventoryLocation.create({
      data: { code: randomUUID(), name: 'Primary', address: 'Test', status: 'ACTIVE' },
    })
    process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID = location.id
  })
  afterAll(async () => {
    await db.$disconnect()
  })
  async function trip(late = false) {
    const t = await db.trip.create({
      data: {
        tripType: 'PUBLIC',
        title: 'Cancellation test',
        status: 'CANCEL_PENDING',
        creatorId: leaderId,
        destinationId,
        pickupPointId: pickupId,
        maxPax: 100,
        startAt: new Date(Date.now() + (late ? -1 : 10) * 86400000),
        endAt: new Date(Date.now() + 11 * 86400000),
      },
    })
    const req = await db.tripCancellationRequest.create({
      data: { tripId: t.id, requestedBy: leaderId, previousTripStatus: 'OPEN', reason: 'Weather' },
    })
    return { t, req }
  }
  async function booking(tripId: string, paid = true, percent = 70) {
    const user = await db.user.create({
      data: { authUserId: randomUUID(), email: randomUUID() + '@test.local', fullName: 'Buyer' },
    })
    const b = await db.booking.create({
      data: {
        tripId,
        userId: user.id,
        pickupPointId: pickupId,
        returnPointId: pickupId,
        bookingPolicyId: policyId,
        status: paid ? 'CONFIRMED' : 'PENDING_PAYMENT',
        participantCount: 1,
        pricePerPaxSnapshot: 1000,
        subtotalAmount: 1000,
        totalAmount: 1000,
        expiresAt: new Date(Date.now() + 900000),
        policySnapshot: {
          cancellationRules: { version: 1, tiers: [{ minHoursBeforeStart: 0, refundPercent: percent }] },
        },
        bookingParticipantsViaBookingId: { create: { fullName: 'Test', userId: user.id, checkinCode: randomUUID() } },
      },
      include: { bookingParticipantsViaBookingId: true },
    })
    const invoice = await db.invoice.create({
      data: {
        invoiceNo: randomUUID(),
        invoiceType: 'BOOKING',
        bookingId: b.id,
        userId: user.id,
        revisionNo: 1,
        status: paid ? 'PAID' : 'PENDING_PAYMENT',
        subtotalAmount: 1000,
        totalAmount: 1000,
      },
    })
    if (paid) await payment(invoice.id, 1000)
    return { b, user, participant: b.bookingParticipantsViaBookingId[0] }
  }
  async function payment(invoiceId: string, amount: number, lineId?: string) {
    const p = await db.payment.create({
      data: {
        invoiceId,
        amount,
        status: 'SUCCEEDED',
        paidAt: new Date(),
        paymentGateway: 'mock',
        providerEnvironment: 'MOCK',
        merchantAccountKey: 'test',
        merchantRequestRef: randomUUID(),
        requestHash: 'a'.repeat(64),
        requestHashVersion: 1,
        paymentMethod: 'REDIRECT',
        idempotencyKey: randomUUID(),
        application: { create: { status: 'APPLIED', decidedAt: new Date(), appliedAt: new Date() } },
        ...(lineId
          ? {
              allocations: {
                create: [
                  { rentalOrderLineId: lineId, component: 'RENTAL_FEE', amount: 100 },
                  { rentalOrderLineId: lineId, component: 'RENTAL_DEPOSIT', amount: 500 },
                ],
              },
            }
          : {}),
      },
    })
    return p
  }
  async function approve(f: Awaited<ReturnType<typeof trip>>, key = randomUUID()) {
    return service.review(
      admin,
      f.req.id,
      'APPROVED',
      { expectedTripVersion: f.t.version, expectedRequestVersion: f.req.version, note: 'Approved' },
      key,
    )
  }
  async function drain() {
    for (let i = 0; i < 6; i++) await service.tick()
  }
  async function rental(f: Awaited<ReturnType<typeof booking>>, state: 'PAID' | 'PENDING_PAYMENT' | 'ACTIVE' = 'PAID') {
    const rp = await db.rentalPolicy.create({
      data: {
        policyCode: randomUUID(),
        versionNo: 1,
        quoteTtlMinutes: 15,
        cutoffHoursBeforeTrip: 1,
        freeCancellationHours: 24,
        cancellationRules: {},
        effectiveFrom: new Date(),
      },
    })
    const category = await db.rentalCategory.create({ data: { name: 'Tent', slug: randomUUID() } })
    const product = await db.rentalProduct.create({
      data: {
        categoryId: category.id,
        sku: randomUUID(),
        name: 'Tent',
        dailyPrice: 100,
        depositValue: 500,
        replacementValue: 1000,
      },
    })
    const start = new Date(Date.now() + 3600000),
      end = new Date(Date.now() + 86400000)
    const common = {
      userId: f.user.id,
      tripId: f.b.tripId,
      bookingId: f.b.id,
      rentalPolicyId: rp.id,
      recipientSnapshot: {},
      rentalStartAt: start,
      rentalEndAt: end,
      plannedHandoverAt: start,
      plannedReturnAt: end,
      occupiedStartAt: start,
      occupiedEndAt: end,
      rentalFee: 100,
      totalDeposit: 500,
      totalAmount: 600,
      policySnapshot: {},
      membershipKind: 'PUBLIC_PARTICIPANT',
      membershipRef: f.participant.id,
      membershipSourceVersion: 1,
    }
    const quote = await db.rentalQuote.create({
      data: { ...common, contextVersion: 2000000000, expiresAt: new Date(Date.now() + 900000) },
    })
    const order = await db.rentalOrder.create({
      data: {
        ...common,
        quoteId: quote.id,
        pickupPointId: pickupId,
        returnPointId: pickupId,
        status: state,
        financialStatus: state === 'PENDING_PAYMENT' ? 'UNPAID' : 'PAID',
        contextVersionSnapshot: 2000000000,
        paymentExpiresAt: new Date(Date.now() + 900000),
        rentalOrderLinesViaOrderId: {
          create: {
            productId: product.id,
            quantity: 1,
            dailyPriceSnapshot: 100,
            depositPerUnitSnapshot: 500,
            replacementValueSnapshot: 1000,
            chargedDays: 1,
            lineRentalFee: 100,
            lineDeposit: 500,
          },
        },
      },
      include: { rentalOrderLinesViaOrderId: true },
    })
    const invoice = await db.invoice.create({
      data: {
        invoiceNo: randomUUID(),
        invoiceType: 'RENTAL',
        rentalOrderId: order.id,
        userId: f.user.id,
        revisionNo: 1,
        status: state === 'PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'PAID',
        subtotalAmount: 600,
        totalAmount: 600,
      },
    })
    if (state !== 'PENDING_PAYMENT') await payment(invoice.id, 600, order.rentalOrderLinesViaOrderId[0].id)
    return order
  }
  it.each([0, 70, 100])(
    'keeps a voluntary %i percent refund unchanged and fully refunds only the live paid booking',
    async (percent) => {
      const f = await trip(),
        a = await booking(f.t.id, true, percent),
        b = await booking(f.t.id),
        unpaid = await booking(f.t.id, false)
      const cancelled = await bookings.cancel({
        bookingId: a.b.id,
        actorId: a.user.id,
        actorRole: 'USER',
        idempotencyKey: randomUUID(),
        reason: 'Changed plans',
      })
      await bookings.dispatch(cancelled.cancellationId)
      await approve(f)
      await drain()
      const ca = await db.bookingCancellation.findMany({ where: { bookingId: a.b.id } }),
        cb = await db.bookingCancellation.findFirstOrThrow({ where: { bookingId: b.b.id } })
      expect(ca).toHaveLength(1)
      expect(ca[0].refundableAmount.toNumber()).toBe(percent * 10)
      expect(ca[0].tripCancellationRequestId).toBeNull()
      expect(cb.refundableAmount.toNumber()).toBe(1000)
      expect(cb.tripCancellationRequestId).toBe(f.req.id)
      const cu = await db.bookingCancellation.findFirstOrThrow({ where: { bookingId: unpaid.b.id } })
      expect(cu.refundableAmount.toNumber()).toBe(0)
      await bookings.dispatch(cb.id)
      await bookings.dispatch(cb.id)
      expect(await db.refund.count({ where: { bookingCancellationId: cb.id } })).toBe(1)
    },
  )
  it('does not increase pending, failed or succeeded voluntary refunds on later approval', async () => {
    for (const status of ['PENDING', 'FAILED', 'SUCCEEDED'] as const) {
      const f = await trip(),
        a = await booking(f.t.id)
      const c = await bookings.cancel({
        bookingId: a.b.id,
        actorId: a.user.id,
        actorRole: 'USER',
        idempotencyKey: randomUUID(),
        reason: 'Self',
      })
      await bookings.dispatch(c.cancellationId)
      await db.refund.updateMany({ where: { bookingCancellationId: c.cancellationId }, data: { status } })
      await approve(f)
      await drain()
      const rows = await db.refund.findMany({ where: { bookingCancellationId: c.cancellationId } })
      expect(rows).toHaveLength(1)
      expect(rows[0].amount.toNumber()).toBe(700)
      expect(rows[0].status).toBe(status)
    }
  })
  it('replays a review idempotently and rejects a conflicting second Admin decision', async () => {
    const f = await trip(),
      key = randomUUID()
    const first = await approve(f, key)
    expect(await approve(f, key)).toEqual(first)
    await expect(
      service.review(
        admin,
        f.req.id,
        'REJECTED',
        { expectedTripVersion: f.t.version, expectedRequestVersion: f.req.version, note: 'Reject' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'TRIP_CANCELLATION_NOT_REVIEWABLE' })
    expect(await db.bookingOutboxEvent.count({ where: { aggregateId: f.t.id, eventType: 'TRIP_CANCELLED' } })).toBe(1)
  })
  it('serializes simultaneous self-cancellation and approval to a single cancellation policy', async () => {
    const f = await trip(),
      a = await booking(f.t.id)
    const results = await Promise.allSettled([
      bookings.cancel({
        bookingId: a.b.id,
        actorId: a.user.id,
        actorRole: 'USER',
        idempotencyKey: randomUUID(),
        reason: 'Self',
      }),
      approve(f),
    ])
    expect(results[1].status).toBe('fulfilled')
    await drain()
    const rows = await db.bookingCancellation.findMany({ where: { bookingId: a.b.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0].refundableAmount.toNumber()).toBe(rows[0].source === 'USER' ? 700 : 1000)
  })
  it('rejects a stale review, permits late approval before operation and blocks checked-in trips', async () => {
    const stale = await trip()
    await expect(
      service.review(
        admin,
        stale.req.id,
        'APPROVED',
        { expectedTripVersion: 999, expectedRequestVersion: 1, note: '' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'TRIP_CANCELLATION_VERSION_CONFLICT' })
    const late = await trip(true),
      unpaid = await booking(late.t.id, false)
    await approve(late)
    await drain()
    expect((await db.booking.findUniqueOrThrow({ where: { id: unpaid.b.id } })).status).toBe('CANCELLED')
    const checked = await trip(),
      a = await booking(checked.t.id)
    await db.bookingParticipant.update({
      where: { id: a.participant.id },
      data: { checkinStatus: 'CHECKED_IN', checkedInAt: new Date() },
    })
    await expect(approve(checked)).rejects.toMatchObject({ code: 'TRIP_CANCELLATION_NOT_REVIEWABLE' })
  })
  it('rejects the request without reviving customer cancellations and restores registration state', async () => {
    const f = await trip(),
      a = await booking(f.t.id)
    await bookings.cancel({
      bookingId: a.b.id,
      actorId: a.user.id,
      actorRole: 'USER',
      idempotencyKey: randomUUID(),
      reason: 'Self',
    })
    await service.review(
      admin,
      f.req.id,
      'REJECTED',
      { expectedTripVersion: 1, expectedRequestVersion: 1, note: 'Can operate' },
      randomUUID(),
    )
    expect((await db.trip.findUniqueOrThrow({ where: { id: f.t.id } })).status).toBe('OPEN')
    expect((await db.booking.findUniqueOrThrow({ where: { id: a.b.id } })).status).toBe('CANCELLED')
  })
  it('preserves a voluntarily cancelled rental, refunds live participant rentals despite a large context hash, and creates no unpaid refund', async () => {
    const f = await trip(),
      a = await booking(f.t.id),
      old = await rental(a),
      live = await rental(a),
      unpaid = await rental(a, 'PENDING_PAYMENT')
    const preview = await rentals.previewCancellation({ orderId: old.id, userId: a.user.id, now: new Date() })
    expect(preview.tripCancellationPending).toBe(true)
    await rentals.cancelOrder({
      orderId: old.id,
      userId: a.user.id,
      reason: 'Self',
      expectedVersion: old.version,
      previewVersion: preview.previewVersion,
      now: new Date(),
    })
    const initial = await db.refund.findMany({ where: { rentalOrderId: old.id } })
    expect(initial[0].amount.toNumber()).toBe(500)
    await approve(f)
    await consumer.tick()
    await drain()
    await consumer.tick()
    expect((await db.rentalOrder.findUniqueOrThrow({ where: { id: live.id } })).status).toBe('CANCELLED')
    expect((await db.refund.findFirstOrThrow({ where: { rentalOrderId: live.id } })).amount.toNumber()).toBe(600)
    expect(await db.refund.count({ where: { rentalOrderId: old.id } })).toBe(1)
    expect((await db.refund.findFirstOrThrow({ where: { rentalOrderId: old.id } })).amount.toNumber()).toBe(500)
    expect((await db.rentalOrder.findUniqueOrThrow({ where: { id: unpaid.id } })).status).toBe('CANCELLED')
    expect(await db.refund.count({ where: { rentalOrderId: unpaid.id } })).toBe(0)
    const detail = await service.detail(admin, f.req.id)
    expect(detail.executionStatus).toBe('COMPLETED')
  })
  it('includes PUBLIC_PARTICIPANT rentals in the booking-specific cascade SQL and query', async () => {
    const f = await trip(),
      a = await booking(f.t.id),
      order = await rental(a)
    await db.booking.update({ where: { id: a.b.id }, data: { status: 'CANCELLED' } })
    await db.bookingCancellation.create({
      data: {
        bookingId: a.b.id,
        source: 'ADMIN',
        idempotencyKey: randomUUID(),
        cancelledBy: admin.id,
        policySnapshot: {},
        refundableAmount: 1000,
      },
    })
    const result = await lifecycle.processBookingCancelled({
      eventId: randomUUID(),
      eventType: 'BOOKING_CANCELLED',
      entityId: a.b.id,
      entityVersion: 2,
      correlationId: randomUUID(),
      occurredAt: new Date(),
      payload: { bookingId: a.b.id, tripId: f.t.id, version: 2, effectiveAt: new Date(), reason: 'Admin' },
    })
    expect(result.cancelledOrderIds).toContain(order.id)
  })
  it('keeps handed-over equipment active, opens a return task and never refunds its deposit immediately', async () => {
    const f = await trip(),
      a = await booking(f.t.id),
      order = await rental(a, 'ACTIVE')
    const pkg = await db.package.create({ data: { orderId: order.id, packageCode: randomUUID() } })
    const task = await db.deliveryTask.create({
      data: {
        orderId: order.id,
        packageId: pkg.id,
        tripId: f.t.id,
        servicePointId: pickupId,
        taskType: 'HANDOVER',
        status: 'HANDED_OVER',
      },
    })
    const code = await db.rentalPickupCode.create({
      data: { orderId: order.id, codeHash: randomUUID(), expiresAt: new Date(Date.now() + 900000) },
    })
    await db.rentalHandover.create({
      data: {
        orderId: order.id,
        packageId: pkg.id,
        deliveryTaskId: task.id,
        pickupCodeId: code.id,
        staffId: admin.id,
        verificationRef: randomUUID(),
        recipientSnapshot: {},
        idempotencyKey: randomUUID(),
      },
    })
    await approve(f)
    await consumer.tick()
    const saved = await db.rentalOrder.findUniqueOrThrow({ where: { id: order.id } })
    expect(saved.status).toBe('ACTIVE')
    expect(saved.exceptionStatus).toBe('ACTION_REQUIRED')
    expect(saved.rentalEndAt).toEqual(order.rentalEndAt)
    expect(await db.deliveryTask.count({ where: { orderId: order.id, taskType: 'RETURN' } })).toBe(1)
    expect(await db.refund.count({ where: { rentalOrderId: order.id } })).toBe(0)
  })
  it('flags transferred packages for custody return without exposing stock as available', async () => {
    const f = await trip(),
      a = await booking(f.t.id),
      order = await rental(a)
    const pkg = await db.package.create({ data: { orderId: order.id, packageCode: randomUUID() } })
    await db.inventoryTask.create({
      data: {
        orderId: order.id,
        packageId: pkg.id,
        inventoryLocationId: process.env.RENTAL_PRIMARY_INVENTORY_LOCATION_ID!,
        status: 'TRANSFERRED',
      },
    })
    const task = await db.deliveryTask.create({
      data: {
        orderId: order.id,
        packageId: pkg.id,
        tripId: f.t.id,
        servicePointId: pickupId,
        taskType: 'HANDOVER',
        status: 'PACKAGE_RECEIVED',
      },
    })
    await approve(f)
    await consumer.tick()
    const saved = await db.rentalOrder.findUniqueOrThrow({ where: { id: order.id } })
    expect(saved.status).toBe('CANCELLED')
    expect(saved.exceptionStatus).toBe('ACTION_REQUIRED')
    expect((await db.deliveryTask.findUniqueOrThrow({ where: { id: task.id } })).exceptionNotes).toBe(
      'RETURN_TO_INVENTORY_LOCATION_REQUIRED',
    )
  })
  it('marks applied extensions for financial review instead of refunding a guessed single-payment amount', async () => {
    const f = await trip(),
      a = await booking(f.t.id),
      order = await rental(a)
    await db.rentalExtensionRequest.create({
      data: {
        orderId: order.id,
        userId: a.user.id,
        status: 'APPLIED',
        previousRentalEndAt: order.rentalEndAt,
        requestedRentalEndAt: new Date(order.rentalEndAt.getTime() + 86400000),
        previousOccupiedUntil: order.occupiedEndAt,
        requestedOccupiedUntil: new Date(order.occupiedEndAt.getTime() + 86400000),
        returnOptionSnapshot: {},
        additionalFee: 100,
        currency: 'VND',
        policySnapshot: {},
        quotedOrderVersion: order.version,
        quoteExpiresAt: new Date(Date.now() + 900000),
      },
    })
    await approve(f)
    await consumer.tick()
    expect((await db.rentalOrder.findUniqueOrThrow({ where: { id: order.id } })).exceptionStatus).toBe(
      'ACTION_REQUIRED',
    )
    expect(await db.refund.count({ where: { rentalOrderId: order.id } })).toBe(0)
  })
  it('routes PRIVATE_TRIP_CANCELLED to trip lifecycle without a Booking cascade', async () => {
    const f = await trip(),
      a = await booking(f.t.id),
      order = await rental(a)
    await db.trip.update({
      where: { id: f.t.id },
      data: { tripType: 'PRIVATE', status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } },
    })
    const result = await consumer.consume({
      id: randomUUID(),
      eventType: 'PRIVATE_TRIP_CANCELLED',
      aggregateId: f.t.id,
      createdAt: new Date(),
      payload: { tripId: f.t.id, version: 2, reason: 'Host cancelled' },
    })
    expect(result?.cancelledOrderIds).toContain(order.id)
  })
  it('reverses late Booking and Rental collections without restoring cancelled orders', async () => {
    const f = await trip(),
      a = await booking(f.t.id, false),
      paidBuyer = await booking(f.t.id),
      order = await rental(paidBuyer, 'PENDING_PAYMENT')
    await approve(f)
    await drain()
    await consumer.tick()
    const invoice = await db.invoice.findFirstOrThrow({ where: { bookingId: a.b.id } })
    const p = await payment(invoice.id, 1000)
    await db.paymentApplication.update({
      where: { paymentId: p.id },
      data: { status: 'PENDING', decidedAt: null, appliedAt: null },
    })
    const event = await db.paymentOutboxEvent.create({
      data: {
        deduplicationKey: randomUUID(),
        eventType: 'PAYMENT_SUCCEEDED',
        aggregateType: 'Payment',
        aggregateId: p.id,
        payload: { schemaVersion: 1, paymentId: p.id, invoiceId: invoice.id },
      },
    })
    await new BookingPaymentConsumer(prism).consume(event.id)
    expect((await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: p.id } })).status).toBe('REJECTED')
    expect((await db.booking.findUniqueOrThrow({ where: { id: a.b.id } })).status).toBe('CANCELLED')
    const reversal = await db.paymentOutboxEvent.findFirstOrThrow({
      where: { aggregateId: p.id, eventType: 'TECHNICAL_REVERSAL_REQUESTED' },
    })
    const recovery = new TechnicalReversalWorker(prism, {
      requestRefund: (input: Parameters<RefundsService['requestRefund']>[0]) => refunds.requestRefund(input),
    } as PaymentsPort)
    await recovery.consume(reversal.id)
    await recovery.consume(reversal.id)
    expect(await db.refund.count({ where: { paymentId: p.id, purpose: 'TECHNICAL_REVERSAL' } })).toBe(1)
    const ri = await db.invoice.findFirstOrThrow({ where: { rentalOrderId: order.id } })
    const rp = await payment(ri.id, 600, order.rentalOrderLinesViaOrderId[0].id)
    await db.paymentApplication.update({
      where: { paymentId: rp.id },
      data: { status: 'PENDING', decidedAt: null, appliedAt: null },
    })
    const re = await db.paymentOutboxEvent.create({
      data: {
        deduplicationKey: randomUUID(),
        eventType: 'PAYMENT_SUCCEEDED',
        aggregateType: 'Payment',
        aggregateId: rp.id,
        payload: { schemaVersion: 1, paymentId: rp.id, invoiceId: ri.id },
      },
    })
    await new RentalPaymentConsumer(prism).consume(re.id)
    expect((await db.rentalOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('CANCELLED')
    expect((await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: rp.id } })).status).toBe('REJECTED')
    const rr = await db.paymentOutboxEvent.findFirstOrThrow({
      where: { aggregateId: rp.id, eventType: 'TECHNICAL_REVERSAL_REQUESTED' },
    })
    await recovery.consume(rr.id)
    expect(await db.refund.count({ where: { paymentId: rp.id, purpose: 'TECHNICAL_REVERSAL' } })).toBe(1)
  })
  it('drains more than 50 old receipts, supports multiple workers, retries errors and recovers an expired lease', async () => {
    const type = 'TEST_CANCELLATION_DELIVERY',
      consumerId = 'test-' + randomUUID()
    await db.bookingOutboxEvent.createMany({
      data: Array.from({ length: 65 }, () => ({
        deduplicationKey: randomUUID(),
        eventType: type,
        aggregateType: 'Trip',
        aggregateId: randomUUID(),
        payload: {},
      })),
    })
    const handled = new Set<string>()
    const handle = async (e: CancellationEvent) => {
      expect(handled.has(e.id)).toBe(false)
      handled.add(e.id)
    }
    for (let i = 0; i < 5; i++)
      await Promise.all([deliveries.run(consumerId, [type], handle), deliveries.run(consumerId, [type], handle)])
    expect(handled.size).toBe(65)
    const bad = await db.bookingOutboxEvent.create({
      data: {
        deduplicationKey: randomUUID(),
        eventType: type,
        aggregateType: 'Trip',
        aggregateId: randomUUID(),
        payload: {},
      },
    })
    await deliveries.run(consumerId, [type], async () => {
      throw new Error('Temporary')
    })
    await db.$executeRaw`UPDATE cancellation_deliveries SET next_attempt_at=now()-interval '1 second',lease_until=now()-interval '1 second',status='RUNNING' WHERE event_id=${bad.id}::uuid AND consumer=${consumerId}`
    await deliveries.run(consumerId, [type], handle)
    expect(handled.size).toBe(66)
  })
  it('keeps pre-rollout events dormant until an explicitly audited replay', async () => {
    const e = await db.bookingOutboxEvent.create({
      data: {
        deduplicationKey: randomUUID(),
        eventType: 'BOOKING_CANCELLED',
        aggregateType: 'Booking',
        aggregateId: randomUUID(),
        createdAt: new Date('2020-01-01'),
        payload: {},
      },
    })
    let called = false
    await deliveries.run('test-history', ['BOOKING_CANCELLED'], async (event) => {
      if (event.id === e.id) called = true
    })
    expect(called).toBe(false)
    await service.retry(admin, e.id, 'rental-lifecycle-v1', 'Historical event reviewed')
    expect(await db.$queryRaw`SELECT * FROM cancellation_deliveries WHERE event_id=${e.id}::uuid`).toHaveLength(1)
  })
  it('returns shared HTTP errors, enforces Admin role and validates review inputs', async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminTripCancellationController],
      providers: [{ provide: TripCancellationService, useValue: service }],
    })
      .overrideGuard(AuthenticationGuard)
      .useValue({ canActivate: () => true })
      .compile()
    const app = module.createNestApplication()
    app.useGlobalFilters(new GlobalErrorFilter())
    app.use((req: any, _res: any, next: () => void) => {
      req[REQUEST_USER_KEY] = admin
      next()
    })
    await app.init()
    try {
      const result = await request(app.getHttpServer())
        .post(`/admin/trip-cancellation-requests/${randomUUID()}/approve`)
        .send({ expectedTripVersion: 1, expectedRequestVersion: 1 })
      expect(result.status).toBe(400)
      expect(result.body.error.code).toBe('VALIDATION_ERROR')
      expect(result.body.meta.requestId).toBeTruthy()
    } finally {
      await app.close()
    }
    await expect(
      service.review(
        { id: leaderId, role: 'LEADER' },
        randomUUID(),
        'APPROVED',
        { expectedTripVersion: 1, expectedRequestVersion: 1, note: '' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
