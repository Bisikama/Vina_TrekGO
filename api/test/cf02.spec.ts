import { createHmac, randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { SharedModule } from '../src/shared/shared.module'
import { PrismaService } from '../src/shared/services/prisma.service'
import { SupabaseService } from '../src/shared/services/supabase.service'
import { GlobalErrorFilter } from '../src/shared/errors'
import envConfig from '../src/shared/config'
import { PaymentsModule } from '../src/modules/payments/payments.module'
import { PaymentProvider } from '../src/modules/payments/payment-provider.port'
import { MockPaymentProvider } from '../src/modules/payments/mock-payment.provider'
import { PaymentWebhooksService } from '../src/modules/payments/payment-webhooks.service'
import { BookingPaymentConsumer } from '../src/modules/bookings/booking-payment.consumer'
import { BookingCancellationService } from '../src/modules/bookings/booking-cancellation.service'
import { BookingsService } from '../src/modules/bookings/bookings.service'

const url = process.env.CF02_TEST_DATABASE_URL
if (
  !url ||
  !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
  !/^\/cf02_test_[a-z0-9_]+$/.test(new URL(url).pathname)
)
  throw new Error(
    'CF02_TEST_DATABASE_URL must name an isolated localhost cf02_test_* database; tests never silently skip',
  )

describe('CF02 PostgreSQL and shared HTTP contract', () => {
  const db = new PrismaClient({ datasourceUrl: url })
  const tokens = new Map<string, { id: string; email: string }>()
  const secret = 'cf02-test-only-webhook-secret-32-bytes'
  let app: INestApplication,
    service: BookingsService,
    inbox: PaymentWebhooksService,
    consumer: BookingPaymentConsumer,
    cancellations: BookingCancellationService
  let userId: string, otherId: string, tripId: string, privateId: string, policyId: string
  const previousSecret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET
  const previousPolicy = process.env.BOOKING_POLICY_CODE
  const body = (count = 1) => ({
    participantCount: count,
    participants: Array.from({ length: count }, (_, i) => ({ fullName: `Member ${i + 1}` })),
  })
  const create = (count = 1, key: string = randomUUID(), actor = userId, trip = tripId) =>
    request(app.getHttpServer())
      .post(`/api/v1/trips/${trip}/bookings`)
      .set('Authorization', `Bearer ${actor}`)
      .set('Idempotency-Key', key)
      .send(body(count))
  const detail = (id: string, actor = userId) =>
    request(app.getHttpServer()).get(`/api/v1/bookings/${id}`).set('Authorization', `Bearer ${actor}`)
  const edit = (id: string, count: number, version = 1, actor = userId) =>
    request(app.getHttpServer())
      .patch(`/api/v1/bookings/${id}/participants`)
      .set('Authorization', `Bearer ${actor}`)
      .send({ ...body(count), expectedVersion: version })
  const pay = (id: string, key: string = randomUUID()) =>
    request(app.getHttpServer())
      .post(`/api/v1/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${userId}`)
      .set('Idempotency-Key', key)
      .send({ paymentMethod: 'REDIRECT' })
  const cancel = (id: string, key: string = randomUUID()) =>
    request(app.getHttpServer())
      .post(`/api/v1/bookings/${id}/cancel`)
      .set('Authorization', `Bearer ${userId}`)
      .set('Idempotency-Key', key)
      .send({ reason: 'Changed plans' })
  const context = (id: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/internal/bookings/${id}/rental-context`)
      .set('x-api-key', envConfig.SECRET_API_KEY)
  async function financialResult(paymentId: string, status: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED', amount?: string) {
    const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } })
    const event = {
      providerEventId: randomUUID(),
      kind: 'PAYMENT',
      merchantRequestRef: payment.merchantRequestRef,
      transactionRef: `mock:${paymentId}`,
      status,
      amount: amount ?? payment.amount.toFixed(),
      currency: 'VND',
      occurredAt: new Date().toISOString(),
    }
    const raw = JSON.stringify(event),
      timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
    const post = () =>
      request(app.getHttpServer())
        .post('/api/v1/payments/webhooks/mock')
        .set('Content-Type', 'application/json')
        .set('x-mock-timestamp', timestamp)
        .set('x-mock-signature', signature)
        .send(raw)
    await Promise.all([post().expect(200), post().expect(200)])
    const stored = await db.paymentWebhookEvent.findFirstOrThrow({ where: { providerEventId: event.providerEventId } })
    await inbox.process(stored.id)
    return db.paymentOutboxEvent.findFirst({ where: { aggregateId: paymentId, eventType: 'PAYMENT_SUCCEEDED' } })
  }
  beforeAll(async () => {
    process.env.PAYMENT_MOCK_WEBHOOK_SECRET = secret
    const module = await Test.createTestingModule({ imports: [SharedModule, PaymentsModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SupabaseService)
      .useValue({ verifyToken: (token: string) => Promise.resolve(tokens.get(token) ?? null) })
      .overrideProvider(PaymentProvider)
      .useValue(new MockPaymentProvider(db as unknown as PrismaService))
      .compile()
    service = module.get(BookingsService)
    inbox = module.get(PaymentWebhooksService)
    consumer = module.get(BookingPaymentConsumer)
    cancellations = module.get(BookingCancellationService)
    app = module.createNestApplication({ rawBody: true })
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
    if (previousSecret === undefined) delete process.env.PAYMENT_MOCK_WEBHOOK_SECRET
    else process.env.PAYMENT_MOCK_WEBHOOK_SECRET = previousSecret
    if (previousPolicy === undefined) delete process.env.BOOKING_POLICY_CODE
    else process.env.BOOKING_POLICY_CODE = previousPolicy
  })
  beforeEach(async () => {
    const users = [] as string[]
    for (let i = 0; i < 2; i++) {
      const user = await db.user.create({
        data: { authUserId: randomUUID(), email: `${randomUUID()}@cf02.test`, fullName: 'CF02 User' },
      })
      tokens.set(user.id, { id: user.authUserId, email: user.email })
      users.push(user.id)
    }
    ;[userId, otherId] = users
    const destination = await db.destination.create({ data: { name: 'CF02 Destination' } })
    const pickup = await db.pickupPoint.create({
      data: {
        code: randomUUID(),
        name: 'CF02 Pickup',
        address: 'Test only',
        latitude: 0,
        longitude: 0,
        createdBy: userId,
      },
    })
    const startAt = new Date(Date.now() + 10 * 86400000),
      endAt = new Date(Date.now() + 11 * 86400000)
    const trip = await db.trip.create({
      data: {
        tripType: 'PUBLIC',
        status: 'OPEN',
        publishedAt: new Date(),
        title: 'CF02 Trip',
        destinationId: destination.id,
        creatorId: userId,
        leaderId: userId,
        pickupPointId: pickup.id,
        startAt,
        endAt,
        maxPax: 3,
        pricePerPax: 125000,
      },
    })
    tripId = trip.id
    privateId = (
      await db.trip.create({
        data: {
          tripType: 'PRIVATE',
          title: 'Private',
          status: 'OPEN',
          destinationId: destination.id,
          creatorId: userId,
          startAt,
          endAt,
          maxPax: 3,
        },
      })
    ).id
    await db.tripTransport.create({
      data: {
        tripId,
        pickupPointId: pickup.id,
        sequence: 1,
        vehicleType: 'Minibus',
        seatCapacity: 16,
        plateNumber: 'PRIVATE-PLATE',
        driverName: 'Private driver',
        driverPhone: '0123456789',
        meetingAt: startAt,
      },
    })
    const policy = await db.bookingPolicy.create({
      data: {
        policyCode: `CF02-${randomUUID()}`,
        versionNo: 1,
        holdTtlMinutes: 15,
        cancellationRules: { version: 1, tiers: [{ minHoursBeforeStart: 0, refundPercent: 100 }] },
        effectiveFrom: new Date(),
      },
    })
    policyId = policy.id
    process.env.BOOKING_POLICY_CODE = policy.policyCode
  })

  it('visitors see only public trips and safe transport; hold requires real shared bearer auth', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/trips').expect(200)
    expect(list.body.items.some((t: { id: string }) => t.id === privateId)).toBe(false)
    const publicTrip = await request(app.getHttpServer()).get(`/api/v1/trips/${tripId}`).expect(200)
    expect(publicTrip.body.transport).toEqual([{ vehicleType: 'Minibus' }])
    expect(JSON.stringify(publicTrip.body)).not.toContain('PRIVATE-PLATE')
    await request(app.getHttpServer()).get(`/api/v1/trips/${privateId}`).expect(404)
    const unauth = await request(app.getHttpServer()).post(`/api/v1/trips/${tripId}/bookings`).send(body()).expect(401)
    expect(unauth.body).toMatchObject({
      error: { code: 'UNAUTHENTICATED', retryable: false },
      meta: { contractVersion: '0.2.0-final-flow' },
    })
  })
  it('creates multi-person hold with server price, invoice and stable replay; rejects duplicate active booking', async () => {
    const [a, b] = await Promise.all([create(2, 'same').expect(201), create(2, 'same').expect(201)])
    expect(a.body.id).toBe(b.body.id)
    expect(a.body).toMatchObject({ status: 'PENDING_PAYMENT', totalAmount: '250000', participantCount: 2 })
    expect(Date.parse(a.body.expiresAt)).toBeGreaterThan(Date.now())
    expect(a.body.participants).toHaveLength(2)
    const duplicate = await create().expect(409)
    expect(duplicate.body.error).toMatchObject({ code: 'ACTIVE_BOOKING_EXISTS', details: { bookingId: a.body.id } })
    expect((await create(1, 'same').expect(409)).body.error.code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD')
    const invoices = await db.invoice.findMany({
      where: { bookingId: a.body.id },
      include: { invoiceLinesViaInvoiceId: true },
    })
    expect(invoices).toHaveLength(1)
    expect(invoices[0].invoiceLinesViaInvoiceId[0].quantity.toNumber()).toBe(2)
  })
  it('serializes two users racing for the last seat, without overselling', async () => {
    await db.trip.update({ where: { id: tripId }, data: { maxPax: 1 } })
    const results = await Promise.all([create(1, 'first'), create(1, 'second', otherId)])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(results.find((r) => r.status === 409)?.body.error.code).toBe('CAPACITY_CONFLICT')
    expect(await db.bookingParticipant.count({ where: { booking: { tripId }, status: 'ACTIVE' } })).toBe(1)
  })
  it('updates delta capacity atomically, snapshots new invoice and rejects stale versions/overflow without partial edits', async () => {
    const a = (await create().expect(201)).body
    await create(1, 'other', otherId).expect(201)
    expect((await edit(a.id, 3).expect(409)).body.error.code).toBe('CAPACITY_CONFLICT')
    expect((await detail(a.id).expect(200)).body).toMatchObject({
      participantCount: 1,
      version: 1,
      totalAmount: '125000',
    })
    const updated = (await edit(a.id, 2).expect(200)).body
    expect(updated).toMatchObject({ participantCount: 2, version: 2, totalAmount: '250000', expiresAt: a.expiresAt })
    expect((await edit(a.id, 1).expect(409)).body.error.code).toBe('BOOKING_VERSION_CONFLICT')
    await edit(a.id, 1, 2).expect(200)
    expect(await db.invoice.count({ where: { bookingId: a.id, status: 'PENDING_PAYMENT' } })).toBe(1)
    expect(await db.invoice.count({ where: { bookingId: a.id, status: 'CANCELLED' } })).toBe(2)
    expect((await pay(a.id).expect(201)).body.amount).toBe('125000')
    expect((await edit(a.id, 2, 3).expect(409)).body.error.code).toBe('PAYMENT_ATTEMPT_IN_PROGRESS')
  })
  it('expires holds, releases seats and active unique slot, preserving replay identity', async () => {
    const a = (await create(3, 'expire').expect(201)).body
    await db.booking.update({ where: { id: a.id }, data: { expiresAt: new Date(0) } })
    const expired = await edit(a.id, 1).expect(410)
    expect(expired.body.error.code).toBe('BOOKING_HOLD_EXPIRED')
    expect((await db.booking.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('EXPIRED')
    expect(await db.bookingParticipant.count({ where: { bookingId: a.id, status: 'ACTIVE' } })).toBe(0)
    expect((await create(3, 'expire').expect(201)).body).toMatchObject({ id: a.id, status: 'EXPIRED' })
    expect((await create(3).expect(201)).body.id).not.toBe(a.id)
  })
  it('scheduled expiry works without a read request', async () => {
    const a = (await create().expect(201)).body
    await db.booking.update({ where: { id: a.id }, data: { expiresAt: new Date(0) } })
    await service.expireTick()
    expect((await db.booking.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('EXPIRED')
  })
  it('validates count, untrusted money, ownership, trip state and policy with shared error envelope', async () => {
    for (const payload of [{ ...body(), totalAmount: 1 }, { ...body(), participantCount: 2 }, body(0)]) {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/trips/${tripId}/bookings`)
        .set('Authorization', `Bearer ${userId}`)
        .set('Idempotency-Key', randomUUID())
        .send(payload)
        .expect(400)
      expect(r.body.error.code).toBe('VALIDATION_ERROR')
      expect(r.body.meta.requestId).toBeTruthy()
    }
    await create(1, 'private', userId, privateId).expect(404)
    const a = (await create().expect(201)).body
    await detail(a.id, otherId).expect(404)
    await edit(a.id, 2, 1, otherId).expect(403)
    await db.trip.update({ where: { id: tripId }, data: { status: 'DRAFT' } })
    await create(1, 'draft', otherId).expect(409)
    await db.trip.update({ where: { id: tripId }, data: { status: 'OPEN' } })
    await db.bookingPolicy.update({ where: { id: policyId }, data: { isActive: false } })
    expect((await create(1, 'no-policy', otherId).expect(503)).body.error.code).toBe('BOOKING_POLICY_UNAVAILABLE')
  })
  it('payment pending/failed never confirms and retry uses the existing server invoice', async () => {
    const a = (await create().expect(201)).body
    const first = (await pay(a.id).expect(201)).body
    expect((await detail(a.id).expect(200)).body.status).toBe('PENDING_PAYMENT')
    await financialResult(first.paymentId, 'FAILED')
    expect((await detail(a.id).expect(200)).body.status).toBe('PENDING_PAYMENT')
    const retry = (await pay(a.id).expect(201)).body
    expect(retry.invoiceId).toBe(first.invoiceId)
    expect(retry.paymentId).not.toBe(first.paymentId)
  })
  it('signed success confirms once, writes complete downstream contract, opens rental context and transport', async () => {
    const a = (await create(2).expect(201)).body
    expect(a.transport).toEqual([{ vehicleType: 'Minibus' }])
    await context(a.id).expect(409)
    await request(app.getHttpServer()).get(`/api/v1/internal/bookings/${a.id}/rental-context`).expect(401)
    const payment = (await pay(a.id).expect(201)).body
    const event = await financialResult(payment.paymentId)
    expect(event).not.toBeNull()
    await Promise.all([consumer.consume(event!.id), consumer.consume(event!.id), consumer.consume(event!.id)])
    const confirmed = (await detail(a.id).expect(200)).body
    expect(confirmed).toMatchObject({
      status: 'CONFIRMED',
      rentalEligible: true,
      canEditParticipants: false,
      canCancel: true,
    })
    expect(confirmed.transport[0]).toMatchObject({ plateNumber: 'PRIVATE-PLATE', driverPhone: '0123456789' })
    const events = await db.bookingOutboxEvent.findMany({
      where: { aggregateId: a.id, eventType: 'BOOKING_CONFIRMED' },
    })
    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({ bookingId: a.id, tripId, userId, confirmedAt: expect.any(String) })
    expect((await context(a.id).expect(200)).body).toMatchObject({
      participantCount: 2,
      bookingId: a.id,
      userId,
      tripId,
    })
    await edit(a.id, 3, 2).expect(409)
    await cancel(a.id, 'confirmed-cancel').expect(202)
    const cancellation = await db.bookingCancellation.findFirstOrThrow({ where: { bookingId: a.id } })
    expect(cancellation.refundableAmount.toFixed()).toBe('250000')
  })
  it.each(['expire', 'cancel'] as const)(
    'late collection after %s never resurrects a hold and requests reversal',
    async (action) => {
      const a = (await create(3).expect(201)).body
      const payment = (await pay(a.id).expect(201)).body
      if (action === 'expire') {
        await db.booking.update({ where: { id: a.id }, data: { expiresAt: new Date(0) } })
        await service.expire(tripId)
      } else {
        await cancel(a.id, 'cancel-hold').expect(202)
        await cancel(a.id, 'cancel-hold').expect(202)
        const c = await db.bookingCancellation.findFirstOrThrow({ where: { bookingId: a.id } })
        await cancellations.dispatch(c.id)
        expect(await db.refund.count({ where: { bookingCancellationId: c.id } })).toBe(0)
      }
      await create(3, 'reallocated', otherId).expect(201)
      const event = await financialResult(payment.paymentId)
      await consumer.consume(event!.id)
      expect((await detail(a.id).expect(200)).body.status).toBe(action === 'expire' ? 'EXPIRED' : 'CANCELLED')
      expect((await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: payment.paymentId } })).status).toBe(
        'REJECTED',
      )
      expect(
        await db.paymentOutboxEvent.count({
          where: { aggregateId: payment.paymentId, eventType: 'TECHNICAL_REVERSAL_REQUESTED' },
        }),
      ).toBe(1)
    },
  )
  it('allows unpaid cancellation but blocks paid cancellation when policy has no refund rules', async () => {
    await db.bookingPolicy.update({ where: { id: policyId }, data: { cancellationRules: {} } })
    const unpaid = (await create().expect(201)).body
    expect(unpaid.canCancel).toBe(true)
    await cancel(unpaid.id).expect(202)
    const paid = (await create(1, 'paid-without-cancel-policy').expect(201)).body
    const payment = (await pay(paid.id).expect(201)).body
    const event = await financialResult(payment.paymentId)
    await consumer.consume(event!.id)
    expect((await detail(paid.id).expect(200)).body).toMatchObject({ status: 'CONFIRMED', canCancel: false })
    const denied = await cancel(paid.id).expect(422)
    expect(denied.body.error.code).toBe('BOOKING_CANCELLATION_POLICY_INVALID')
    expect(await db.refund.count({ where: { paymentId: payment.paymentId } })).toBe(0)
  })
  it('rejects wrong payment amount rather than confirming', async () => {
    const a = (await create().expect(201)).body,
      payment = (await pay(a.id).expect(201)).body
    await financialResult(payment.paymentId, 'SUCCEEDED', '1')
    expect((await detail(a.id).expect(200)).body.status).toBe('PENDING_PAYMENT')
    expect(await db.bookingOutboxEvent.count({ where: { aggregateId: a.id, eventType: 'BOOKING_CONFIRMED' } })).toBe(0)
  })
  it('my bookings are owner scoped and support status pagination', async () => {
    const a = (await create().expect(201)).body
    await create(1, 'other', otherId).expect(201)
    const list = await request(app.getHttpServer())
      .get('/api/v1/bookings?status=PENDING_PAYMENT&pageSize=1')
      .set('Authorization', `Bearer ${userId}`)
      .expect(200)
    expect(list.body.total).toBe(1)
    expect(list.body.items.map((b: { id: string }) => b.id)).toEqual([a.id])
  })
})
