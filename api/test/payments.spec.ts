import { createHmac, randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { PaymentsModule } from '../src/modules/payments/payments.module'
import { PaymentProvider } from '../src/modules/payments/payment-provider.port'
import { MockPaymentProvider } from '../src/modules/payments/mock-payment.provider'
import { MomoPaymentProvider, momoSignature } from '../src/modules/payments/momo-payment.provider'
import { SharedModule } from '../src/shared/shared.module'
import { PrismaService } from '../src/shared/services/prisma.service'
import { SupabaseService } from '../src/shared/services/supabase.service'
import { GlobalErrorFilter } from '../src/shared/errors'
import { PaymentWebhooksService } from '../src/modules/payments/payment-webhooks.service'
import { PaymentEventsWorker } from '../src/modules/payments/payment-events.worker'
import { BookingPaymentConsumer } from '../src/modules/bookings/booking-payment.consumer'
import { BookingCancellationService } from '../src/modules/bookings/booking-cancellation.service'
import { PaymentRecoveryService } from '../src/modules/payments/payment-recovery.service'
import { RefundsService } from '../src/modules/payments/refunds.service'
import { TechnicalReversalWorker } from '../src/modules/payments/technical-reversal.worker'
import { ApplyTrailPaymentUseCase } from '../src/modules/system-trail/application/use-cases/apply-trail-payment.use-case'
import { RentalPaymentConsumer } from '../src/modules/rental/payments/rental-payment.consumer'
import { RentalDepositWorker } from '../src/modules/rental/payments/rental-deposit.worker'

const url = process.env.PAYMENT_TEST_DATABASE_URL
if (url) {
  const u = new URL(url)
  if (!['localhost', '127.0.0.1'].includes(u.hostname) || !/^\/payment_test_[a-z0-9_]+$/.test(u.pathname))
    throw new Error('Isolated localhost payment_test_* database required')
}
;(url ? describe : describe.skip)('M1-M9 real PostgreSQL shared payment contract', () => {
  const db = new PrismaClient({ datasourceUrl: url ?? 'postgresql://unused@127.0.0.1:1/payment_test_unused' })
  const provider = new MockPaymentProvider(db as unknown as PrismaService)
  const tokens = new Map<string, { id: string; email: string }>()
  let app: INestApplication
  let inbox: PaymentWebhooksService, consumer: BookingPaymentConsumer, worker: PaymentEventsWorker
  let recovery: PaymentRecoveryService, refunds: RefundsService, cancellations: BookingCancellationService
  let reversals: TechnicalReversalWorker
  let trailConsumer: ApplyTrailPaymentUseCase
  let rentalConsumer: RentalPaymentConsumer, deposits: RentalDepositWorker
  const secret = 'test-only-webhook-secret-at-least-32-bytes'
  const previousSecret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET
  let userId: string, bookingId: string, invoiceId: string, tripId: string
  const post = (key = 'checkout', body: object = { paymentMethod: 'QR' }, token = userId, id = bookingId) =>
    request(app.getHttpServer())
      .post(`/api/v1/bookings/${id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body)
  const webhook = (raw: string, timestamp = Math.floor(Date.now() / 1000).toString(), signature?: string) =>
    request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('Content-Type', 'application/json')
      .set('x-mock-timestamp', timestamp)
      .set('x-mock-signature', signature ?? createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex'))
      .send(raw)
  const providerEvent = async (paymentId: string, overrides: Record<string, unknown> = {}) => {
    const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } })
    return {
      providerEventId: randomUUID(),
      kind: 'PAYMENT',
      merchantRequestRef: payment.merchantRequestRef,
      transactionRef: `mock-txn:${paymentId}`,
      status: 'SUCCEEDED',
      amount: payment.amount.toFixed(),
      currency: payment.currency,
      occurredAt: new Date().toISOString(),
      ...overrides,
    }
  }
  const processWebhook = async (event: { providerEventId: string }) => {
    const stored = await db.paymentWebhookEvent.findFirstOrThrow({ where: { providerEventId: event.providerEventId } })
    await inbox.process(stored.id)
    return stored.id
  }
  const successEvent = (paymentId: string) =>
    db.paymentOutboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: `payment:${paymentId}:succeeded:v1` },
    })
  const detail = () =>
    request(app.getHttpServer()).get(`/api/v1/bookings/${bookingId}`).set('Authorization', `Bearer ${userId}`)
  beforeAll(async () => {
    process.env.PAYMENT_MOCK_WEBHOOK_SECRET = secret
    const module = await Test.createTestingModule({ imports: [SharedModule, PaymentsModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(SupabaseService)
      .useValue({ verifyToken: (token: string) => Promise.resolve(tokens.get(token) ?? null) })
      .overrideProvider(PaymentProvider)
      .useValue(provider)
      .compile()
    inbox = module.get(PaymentWebhooksService)
    consumer = module.get(BookingPaymentConsumer)
    worker = module.get(PaymentEventsWorker)
    recovery = module.get(PaymentRecoveryService)
    refunds = module.get(RefundsService)
    cancellations = module.get(BookingCancellationService)
    reversals = module.get(TechnicalReversalWorker)
    trailConsumer = module.get(ApplyTrailPaymentUseCase)
    rentalConsumer = module.get(RentalPaymentConsumer)
    deposits = module.get(RentalDepositWorker)
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
  })
  beforeEach(async () => {
    jest.restoreAllMocks()
    const user = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@payment.test`, fullName: 'Payment fixture' },
    })
    userId = user.id
    tokens.set(user.id, { id: user.authUserId, email: user.email })
    const d = await db.destination.create({ data: { name: 'Payment test' } })
    const p = await db.pickupPoint.create({
      data: { code: randomUUID(), name: 'Pickup', address: 'Test', latitude: 0, longitude: 0, createdBy: user.id },
    })
    const trip = await db.trip.create({
      data: {
        tripType: 'PUBLIC',
        status: 'OPEN',
        title: 'Payment test',
        destinationId: d.id,
        creatorId: user.id,
        startAt: new Date('2035-01-01'),
        endAt: new Date('2035-01-02'),
        maxPax: 10,
      },
    })
    tripId = trip.id
    const policy = await db.bookingPolicy.create({
      data: {
        policyCode: randomUUID(),
        versionNo: 1,
        holdTtlMinutes: 15,
        cancellationRules: {},
        effectiveFrom: new Date(),
      },
    })
    const booking = await db.booking.create({
      data: {
        tripId,
        userId,
        pickupPointId: p.id,
        returnPointId: p.id,
        bookingPolicyId: policy.id,
        participantCount: 1,
        pricePerPaxSnapshot: 1000,
        subtotalAmount: 1000,
        insuranceAmount: 100,
        discountAmount: 50,
        totalAmount: 1050,
        policySnapshot: {},
        expiresAt: new Date(Date.now() + 900000),
        bookingParticipantsViaBookingId: { create: { fullName: 'Participant', checkinCode: randomUUID() } },
      },
    })
    bookingId = booking.id
    const invoice = await db.invoice.create({
      data: {
        invoiceNo: randomUUID(),
        invoiceType: 'BOOKING',
        userId,
        bookingId,
        revisionNo: 1,
        subtotalAmount: 1100,
        discountAmount: 50,
        totalAmount: 1050,
        invoiceLinesViaInvoiceId: {
          create: [
            { lineCode: 'BOOKING_FARE', description: 'Fare', quantity: 1, unitAmount: 1000, lineAmount: 1000 },
            { lineCode: 'BOOKING_INSURANCE', description: 'Insurance', quantity: 1, unitAmount: 100, lineAmount: 100 },
          ],
        },
      },
    })
    invoiceId = invoice.id
  })

  it.each(['ipn', 'query'])(
    'M9 MoMo %s confirms once, ACKs durable intake and recovers a refund after lost response',
    async (mode) => {
      const oldEnv = { ...process.env }
      try {
        Object.assign(process.env, {
          PAYMENT_PROVIDER: 'momo',
          PAYMENT_PROVIDER_ENVIRONMENT: 'SANDBOX',
          MOMO_SANDBOX_PARTNER_CODE: `TEST_${randomUUID()}`,
          MOMO_SANDBOX_ACCESS_KEY: 'test-access',
          MOMO_SANDBOX_SECRET_KEY: 'test-secret',
          MOMO_SANDBOX_IPN_URL: 'https://merchant.test/api/v1/payments/webhooks/momo',
          MOMO_SANDBOX_REDIRECT_URL: 'https://merchant.test/return',
        })
        delete process.env.PAYMENT_PROVIDER_TIMEOUT_SECONDS
        delete process.env.PAYMENT_RECOVERY_LEASE_SECONDS
        const momo = new MomoPaymentProvider(db as unknown as PrismaService)
        jest.replaceProperty(provider, 'scope', momo.scope)
        jest.spyOn(provider, 'createPayment').mockImplementation((x) => momo.createPayment(x))
        jest.spyOn(provider, 'queryPayment').mockImplementation((x) => momo.queryPayment(x))
        jest.spyOn(provider, 'refund').mockImplementation((x) => momo.refund(x))
        jest.spyOn(provider, 'queryRefund').mockImplementation((x) => momo.queryRefund(x))
        jest.spyOn(provider, 'verifyWebhook').mockImplementation((x) => momo.verifyWebhook(x))
        jest.spyOn(provider, 'observeVerifiedEvent').mockResolvedValue()
        let submittedRefund: string | null = null,
          refundCalls = 0
        const transId = Math.floor(Math.random() * 1000000000) + 1000000000
        jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
          const body = JSON.parse(options!.body as string)
          const result = {
            partnerCode: body.partnerCode,
            orderId: body.orderId,
            requestId: body.requestId,
            amount: 1050,
            transId,
            responseTime: Date.now(),
            resultCode: 0,
          }
          if (String(url).endsWith('/create'))
            return new Response(
              JSON.stringify({ ...result, payUrl: 'https://test-payment.momo.vn/v2/gateway/pay?t=fixture' }),
            )
          if (String(url).endsWith('/refund')) {
            refundCalls++
            submittedRefund = body.orderId
            throw new Error('Response lost after PSP accepted refund')
          }
          if (String(url).endsWith('/refund/query'))
            return new Response(
              JSON.stringify({
                ...result,
                resultCode: submittedRefund ? 0 : 42,
                refundTrans: submittedRefund
                  ? [
                      {
                        orderId: submittedRefund,
                        amount: 1050,
                        resultCode: 0,
                        transId: transId + 1,
                        createdTime: Date.now(),
                      },
                    ]
                  : [],
              }),
            )
          return new Response(JSON.stringify(result))
        })
        const created = (await post().expect(201)).body
        const id = created.paymentId
        expect(created).toMatchObject({ providerEnvironment: 'SANDBOX', status: 'PROCESSING' })
        expect((await post().expect(200)).body.paymentId).toBe(id)
        const payment = await db.payment.findUniqueOrThrow({ where: { id } })
        const wireOrder = payment.merchantRequestRef!.replace(':', '-')
        if (mode === 'ipn') {
          const data = {
            partnerCode: momo.scope.merchantAccountKey,
            orderId: wireOrder,
            requestId: wireOrder,
            amount: 1050,
            transId,
            responseTime: Date.now(),
            resultCode: 0,
            extraData: '',
            message: 'OK',
            orderInfo: 'TrekGo payment',
            orderType: 'momo_wallet',
            payType: 'qr',
          }
          const signature = momoSignature(
            data,
            'amount extraData message orderId orderInfo orderType partnerCode payType requestId responseTime resultCode transId',
            'test-access',
            'test-secret',
          )
          const send = (body: object) => request(app.getHttpServer()).post('/api/v1/payments/webhooks/momo').send(body)
          const bad = await send({ ...data, signature: '0'.repeat(64) }).expect(401)
          expect(bad.body.error.code).toBe('PAYMENT_WEBHOOK_INVALID_SIGNATURE')
          const failure = jest.spyOn(db, '$transaction').mockRejectedValueOnce(new Error('storage unavailable'))
          await send({ ...data, signature }).expect(503)
          failure.mockRestore()
          const ack = await send({ ...data, signature }).expect(204)
          expect(ack.text).toBe('')
          await send({ signature, ...data }).expect(204)
          await request(app.getHttpServer())
            .post('/api/v1/payments/webhooks/mock')
            .send({ ...data, signature })
            .expect(401)
          expect(
            await db.paymentWebhookEvent.count({ where: { merchantAccountKey: momo.scope.merchantAccountKey } }),
          ).toBe(1)
          await worker.tick()
        } else {
          await duePayment(id)
          await recovery.reconcilePayment(id)
        }
        await consumer.consume((await successEvent(id)).id)
        await consumer.consume((await successEvent(id)).id)
        expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('CONFIRMED')
        expect(await db.paymentApplication.count({ where: { paymentId: id, status: 'APPLIED' } })).toBe(1)
        const decision = await approvedCancellation('1050')
        const refund = await requestRefund(id, decision.id, '1050')
        await recovery.reconcileRefund(refund.refundId)
        expect((await db.refund.findUniqueOrThrow({ where: { id: refund.refundId } })).status).toBe('PROCESSING')
        await dueRefund(refund.refundId)
        await recovery.reconcileRefund(refund.refundId)
        expect((await db.refund.findUniqueOrThrow({ where: { id: refund.refundId } })).status).toBe('SUCCEEDED')
        expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('REFUNDED')
        expect(refundCalls).toBe(1)
      } finally {
        jest.restoreAllMocks()
        process.env = oldEnv
      }
    },
  )

  it('creates mock checkout from server snapshots, replays after expiry, never confirms booking', async () => {
    const create = jest.spyOn(provider, 'createPayment')
    const first = await post().expect(201)
    expect(first.body).toMatchObject({
      amount: '1050',
      currency: 'VND',
      invoiceId,
      providerEnvironment: 'MOCK',
      status: 'PROCESSING',
      checkout: { type: 'QR' },
    })
    expect(first.body).not.toHaveProperty('gatewayPayload')
    await db.booking.update({ where: { id: bookingId }, data: { status: 'EXPIRED' } })
    expect((await post().expect(200)).body).toEqual(first.body)
    expect(create).toHaveBeenCalledTimes(1)
    expect(await db.payment.count({ where: { invoiceId } })).toBe(1)
    expect(await db.paymentApplication.count({ where: { invoiceId } })).toBe(0)
    expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).confirmedAt).toBeNull()
  })

  it('same key with a different method returns registered 409 error', async () => {
    await post().expect(201)
    const r = await post('checkout', { paymentMethod: 'REDIRECT' }).expect(409)
    expect(r.body.error).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', retryable: false })
    expect(r.body.meta.contractVersion).toBe('0.2.0-final-flow')
  })

  it('same actor/key cannot be reused against a different owned booking', async () => {
    await post().expect(201)
    const source = await db.booking.findUniqueOrThrow({ where: { id: bookingId } })
    const other = await db.booking.create({ data: { ...source, id: randomUUID(), status: 'CANCELLED' } })
    const response = await post('checkout', { paymentMethod: 'QR' }, userId, other.id).expect(409)
    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD')
  })

  it('production mock checkout requires explicit opt-in', async () => {
    const oldNodeEnv = process.env.NODE_ENV
    const oldFlag = process.env.PAYMENT_MOCK_ENABLED
    try {
      process.env.NODE_ENV = 'production'
      delete process.env.PAYMENT_MOCK_ENABLED
      await post().expect(503)
      expect(await db.payment.count({ where: { invoiceId } })).toBe(0)
      process.env.PAYMENT_MOCK_ENABLED = 'true'
      await post().expect(201)
    } finally {
      if (oldNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = oldNodeEnv
      if (oldFlag === undefined) delete process.env.PAYMENT_MOCK_ENABLED
      else process.env.PAYMENT_MOCK_ENABLED = oldFlag
    }
  })

  it('two parallel different keys reserve only one open attempt', async () => {
    const results = await Promise.all([post('one'), post('two')])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(results.find((r) => r.status === 409)?.body.error.code).toBe('PAYMENT_ATTEMPT_IN_PROGRESS')
    expect(await db.payment.count({ where: { invoiceId } })).toBe(1)
  })

  it('parallel same key submits provider once; pending replay returns the same identity', async () => {
    const original = provider.createPayment.bind(provider)
    const spy = jest.spyOn(provider, 'createPayment').mockImplementation(async (input) => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return original(input)
    })
    const results = await Promise.all([post(), post()])
    expect(results.every((r) => [200, 201, 202].includes(r.status))).toBe(true)
    expect(results[0].body.paymentId).toBe(results[1].body.paymentId)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('rejects client money, missing key and malformed UUID through global filter', async () => {
    const r = await post('money', { paymentMethod: 'QR', amount: '1' }).expect(400)
    expect(r.body.error.code).toBe('VALIDATION_ERROR')
    await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/payments`)
      .set('Authorization', `Bearer ${userId}`)
      .send({ paymentMethod: 'QR' })
      .expect(400)
    await post('bad', { paymentMethod: 'QR' }, userId, 'bad-id').expect(400)
    expect(await db.payment.count({ where: { invoiceId } })).toBe(0)
  })

  it('requires real shared bearer guard and ownership', async () => {
    await post('bad', { paymentMethod: 'QR' }, 'invalid-token').expect(401)
    const other = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@payment.test`, fullName: 'Other' },
    })
    tokens.set(other.id, { id: other.authUserId, email: other.email })
    await post('owner', { paymentMethod: 'QR' }, other.id).expect(404)
  })

  it('blocks expired holds, CANCEL_PENDING and zero amounts', async () => {
    await db.trip.update({ where: { id: tripId }, data: { status: 'CANCEL_PENDING' } })
    await post().expect(409)
    await db.trip.update({ where: { id: tripId }, data: { status: 'OPEN' } })
    await db.invoice.update({ where: { id: invoiceId }, data: { totalAmount: 0, discountAmount: 1100 } })
    await post().expect(422)
    await db.booking.update({ where: { id: bookingId }, data: { expiresAt: new Date(0) } })
    const expired = await post().expect(410)
    expect(expired.body.error.code).toBe('BOOKING_HOLD_EXPIRED')
  })

  it('unknown provider result remains open and returns 202 on replay without submitting again', async () => {
    const create = jest.spyOn(provider, 'createPayment').mockRejectedValue(new Error('timeout'))
    const first = await post().expect(202)
    expect(first.body).toMatchObject({ status: 'PROCESSING', checkout: null, reconciliationRequired: true })
    expect((await post().expect(202)).body.paymentId).toBe(first.body.paymentId)
    await post('replacement').expect(409)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('allows a new attempt on the same invoice after authoritative failure', async () => {
    const first = await post().expect(201)
    await db.payment.update({ where: { id: first.body.paymentId }, data: { status: 'FAILED' } })
    const next = await post('retry', { paymentMethod: 'REDIRECT' }).expect(201)
    expect(next.body.invoiceId).toBe(invoiceId)
    expect(next.body.paymentId).not.toBe(first.body.paymentId)
    expect(next.body.checkout.url).toContain('https://checkout.trekgo.invalid/mock/')
  })

  it('M2 commits financial success and PENDING application; M3 confirms atomically once under competing consumers', async () => {
    const checkout = await post().expect(201)
    const event = await providerEvent(checkout.body.paymentId)
    const raw = JSON.stringify(event)
    const responses = await Promise.all([webhook(raw), webhook(raw), webhook(raw)])
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
    expect(responses[0].body).toEqual({ received: true })
    expect(await db.paymentWebhookEvent.count({ where: { providerEventId: event.providerEventId } })).toBe(1)
    const stored = await db.paymentWebhookEvent.findFirstOrThrow({ where: { providerEventId: event.providerEventId } })
    expect(stored.processingStatus).toBe('RECEIVED')
    await Promise.all([inbox.process(stored.id), inbox.process(stored.id)])
    const financial = await db.payment.findUniqueOrThrow({
      where: { id: checkout.body.paymentId },
      include: { application: true },
    })
    expect(financial.status).toBe('SUCCEEDED')
    expect(financial.application?.status).toBe('PENDING')
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('PENDING_PAYMENT')
    expect((await detail().expect(200)).body).toMatchObject({
      status: 'PENDING_PAYMENT',
      paymentSummary: { status: 'SUCCEEDED', applicationStatus: 'PENDING' },
    })
    const outbox = await successEvent(financial.id)
    await Promise.all([consumer.consume(outbox.id), consumer.consume(outbox.id), consumer.consume(outbox.id)])
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } })
    expect(booking.status).toBe('CONFIRMED')
    expect(booking.confirmationIdempotencyKey).toBe(`payment:${financial.id}`)
    expect(booking.version).toBe(2)
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('PAID')
    expect(await db.paymentConsumerReceipt.count({ where: { eventId: outbox.id } })).toBe(1)
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: bookingId, eventType: 'BOOKING_CONFIRMED' } }),
    ).toBe(1)
    const response = await detail().expect(200)
    expect(response.body).toMatchObject({
      status: 'CONFIRMED',
      paymentSummary: { applicationStatus: 'APPLIED' },
      refunds: [],
    })
    expect(response.body).not.toHaveProperty('gatewayPayload')
    // Distinct delivery ID of the same result also has no additional business effect.
    const repeated = { ...event, providerEventId: randomUUID() }
    await webhook(JSON.stringify(repeated)).expect(200)
    await processWebhook(repeated)
    expect(
      await db.paymentOutboxEvent.count({ where: { aggregateId: financial.id, eventType: 'PAYMENT_SUCCEEDED' } }),
    ).toBe(1)
    expect((await post().expect(200)).body.status).toBe('SUCCEEDED')
  })

  it('rejects invalid/stale signatures, forged environment and malformed signed payload without intake', async () => {
    const checkout = await post().expect(201)
    const event = await providerEvent(checkout.body.paymentId)
    const raw = JSON.stringify(event)
    const invalid = await webhook(raw, undefined, '0'.repeat(64)).expect(401)
    expect(invalid.body.error.code).toBe('PAYMENT_WEBHOOK_INVALID_SIGNATURE')
    await webhook(raw, '1000000000').expect(401)
    await webhook(JSON.stringify({ ...event, environment: 'PRODUCTION' })).expect(400)
    await webhook(JSON.stringify({ ...event, transactionRef: null })).expect(400)
    expect(await db.paymentWebhookEvent.count({ where: { providerEventId: event.providerEventId } })).toBe(0)
  })

  it('does not ACK when durable intake fails', async () => {
    const event = await providerEvent((await post().expect(201)).body.paymentId)
    jest.spyOn(db, '$transaction').mockRejectedValueOnce(new Error('storage unavailable'))
    const response = await webhook(JSON.stringify(event)).expect(503)
    expect(response.body.error).toMatchObject({ code: 'PAYMENT_WEBHOOK_STORAGE_UNAVAILABLE', retryable: true })
    expect(await db.paymentWebhookEvent.count({ where: { providerEventId: event.providerEventId } })).toBe(0)
    await webhook(JSON.stringify(event)).expect(200)
  })

  it('retains original payload and audits event identity collisions', async () => {
    const event = await providerEvent((await post().expect(201)).body.paymentId)
    await webhook(JSON.stringify(event)).expect(200)
    await webhook(JSON.stringify({ ...event, amount: '999' })).expect(200)
    const stored = await db.paymentWebhookEvent.findFirstOrThrow({ where: { providerEventId: event.providerEventId } })
    expect(stored.processingStatus).toBe('NEEDS_REVIEW')
    expect((stored.payload as Record<string, unknown>).amount).toBe('1050')
    expect(await db.auditLog.count({ where: { entityId: stored.id, action: 'PAYMENT_WEBHOOK_ID_COLLISION' } })).toBe(1)
    await inbox.process(stored.id)
    expect(await db.paymentApplication.count({ where: { invoiceId } })).toBe(0)
  })

  it.each([{ amount: '1049' }, { currency: 'USD' }])(
    'quarantines mismatching provider amount/currency %j',
    async (override) => {
      const id = (await post().expect(201)).body.paymentId
      const event = await providerEvent(id, override)
      await webhook(JSON.stringify(event)).expect(200)
      const eventId = await processWebhook(event)
      expect((await db.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })).processingStatus).toBe(
        'NEEDS_REVIEW',
      )
      expect((await db.payment.findUniqueOrThrow({ where: { id } })).reconcileStatus).toBe('NEEDS_REVIEW')
      expect(await db.paymentApplication.count({ where: { invoiceId } })).toBe(0)
    },
  )

  it('keeps a signed event whose payment is missing for retry', async () => {
    const event = {
      providerEventId: randomUUID(),
      kind: 'PAYMENT',
      merchantRequestRef: `payment:${randomUUID()}`,
      transactionRef: randomUUID(),
      status: 'SUCCEEDED',
      amount: '1050',
      currency: 'VND',
      occurredAt: new Date().toISOString(),
    }
    await webhook(JSON.stringify(event)).expect(200)
    const id = await processWebhook(event)
    const stored = await db.paymentWebhookEvent.findUniqueOrThrow({ where: { id } })
    expect(stored).toMatchObject({ processingStatus: 'RETRY', processed: false, paymentId: null })
    expect(stored.nextRetryAt).not.toBeNull()
  })

  it('payload collision after financial processing blocks pending domain application for review', async () => {
    const id = (await post().expect(201)).body.paymentId
    const event = await providerEvent(id)
    await webhook(JSON.stringify(event)).expect(200)
    const eventId = await processWebhook(event)
    await webhook(JSON.stringify({ ...event, amount: '999' })).expect(200)
    expect((await db.paymentWebhookEvent.findUniqueOrThrow({ where: { id: eventId } })).processed).toBe(true)
    expect((await db.payment.findUniqueOrThrow({ where: { id } })).reconcileStatus).toBe('NEEDS_REVIEW')
    await expect(consumer.consume((await successEvent(id)).id)).rejects.toThrow('Payment requires review')
    expect((await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: id } })).status).toBe('PENDING')
    expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).confirmedAt).toBeNull()
  })

  it('webhook before create response preserves terminal state and later out-of-order failure cannot roll it back', async () => {
    jest.spyOn(provider, 'createPayment').mockImplementationOnce(async (input) => {
      const payment = await db.payment.findFirstOrThrow({ where: { merchantRequestRef: input.merchantRequestRef } })
      const event = await providerEvent(payment.id)
      await webhook(JSON.stringify(event)).expect(200)
      await processWebhook(event)
      return {
        kind: 'CONFIRMED_RESULT',
        status: 'PROCESSING',
        checkout: { type: 'QR', qrData: 'late-create', url: null },
      }
    })
    const checkout = await post().expect(201)
    expect(checkout.body.status).toBe('SUCCEEDED')
    const event = await providerEvent(checkout.body.paymentId, { status: 'FAILED', transactionRef: null })
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    expect((await db.payment.findUniqueOrThrow({ where: { id: checkout.body.paymentId } })).status).toBe('SUCCEEDED')
  })

  it('terminal failure then success is retained for review, never blindly overwritten', async () => {
    const id = (await post().expect(201)).body.paymentId
    const failed = await providerEvent(id, { status: 'FAILED' })
    await webhook(JSON.stringify(failed)).expect(200)
    await processWebhook(failed)
    const success = await providerEvent(id)
    await webhook(JSON.stringify(success)).expect(200)
    await processWebhook(success)
    expect(await db.payment.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'FAILED',
      reconcileStatus: 'NEEDS_REVIEW',
    })
    expect(await db.paymentApplication.count({ where: { invoiceId } })).toBe(0)
  })

  it.each(['EXPIRED', 'CANCEL_PENDING'] as const)(
    'M3 rejects %s without resurrecting the booking or losing collection',
    async (state) => {
      const id = (await post().expect(201)).body.paymentId
      const event = await providerEvent(id)
      await webhook(JSON.stringify(event)).expect(200)
      await processWebhook(event)
      if (state === 'EXPIRED') await db.booking.update({ where: { id: bookingId }, data: { expiresAt: new Date(0) } })
      else await db.trip.update({ where: { id: tripId }, data: { status: 'CANCEL_PENDING' } })
      await consumer.consume((await successEvent(id)).id)
      expect((await db.payment.findUniqueOrThrow({ where: { id } })).status).toBe('SUCCEEDED')
      expect(await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: id } })).toMatchObject({
        status: 'REJECTED',
        reasonCode: state === 'EXPIRED' ? 'LATE_PAYMENT' : 'DOMAIN_NOT_ELIGIBLE',
      })
      expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).confirmedAt).toBeNull()
      expect(await db.refund.count({ where: { paymentId: id } })).toBe(0)
      expect(
        await db.paymentOutboxEvent.count({ where: { aggregateId: id, eventType: 'TECHNICAL_REVERSAL_REQUESTED' } }),
      ).toBe(1)
      const reversal = await db.paymentOutboxEvent.findUniqueOrThrow({
        where: {
          deduplicationKey: `payment:${id}:technical-reversal-requested:v1`,
        },
      })
      await Promise.all([reversals.consume(reversal.id), reversals.consume(reversal.id)])
      const refund = await db.refund.findFirstOrThrow({ where: { paymentId: id } })
      await recovery.reconcileRefund(refund.id)
      expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe('SUCCEEDED')
      expect(await db.refund.count({ where: { paymentId: id } })).toBe(1)
      expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).confirmedAt).toBeNull()
      expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('PENDING_PAYMENT')
    },
  )

  it('FULL caused by this valid hold can confirm via durable worker', async () => {
    const id = (await post().expect(201)).body.paymentId
    await db.trip.update({ where: { id: tripId }, data: { status: 'FULL', maxPax: 1 } })
    const event = await providerEvent(id)
    await webhook(JSON.stringify(event)).expect(200)
    // Drain bounded batches so retained fixtures in the reusable DB do not affect this assertion.
    for (let tick = 0; tick < 5; tick++) {
      await worker.tick()
      if ((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status === 'CONFIRMED') break
    }
    expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('CONFIRMED')
  })

  it('application transaction rollback retains PENDING and safely retries without duplicate confirmation', async () => {
    const id = (await post().expect(201)).body.paymentId
    const event = await providerEvent(id)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    const outbox = await successEvent(id)
    // Force a failure late in T5, after Booking/Invoice/application writes, using the real unique constraint.
    const blocker = await db.bookingOutboxEvent.create({
      data: {
        deduplicationKey: `booking:${bookingId}:confirmed:v1`,
        eventType: 'TEST_BLOCKER',
        aggregateType: 'Booking',
        aggregateId: bookingId,
        payload: {},
      },
    })
    await expect(consumer.consume(outbox.id)).rejects.toThrow()
    expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('PENDING_PAYMENT')
    expect((await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: id } })).status).toBe('PENDING')
    expect(await db.paymentConsumerReceipt.count({ where: { eventId: outbox.id } })).toBe(0)
    await db.bookingOutboxEvent.delete({ where: { id: blocker.id } })
    await consumer.consume(outbox.id)
    expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('CONFIRMED')
  })

  it('Booking detail enforces ownership and authenticated context', async () => {
    await request(app.getHttpServer()).get(`/api/v1/bookings/${bookingId}`).expect(401)
    const other = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@payment.test`, fullName: 'Other' },
    })
    tokens.set(other.id, { id: other.authUserId, email: other.email })
    await request(app.getHttpServer())
      .get(`/api/v1/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${other.id}`)
      .expect(404)
    expect((await detail().expect(200)).body.paymentSummary).toBeNull()
  })

  it('financial result, application and success outbox roll back together on failure', async () => {
    const id = (await post().expect(201)).body.paymentId
    const event = await providerEvent(id)
    await webhook(JSON.stringify(event)).expect(200)
    const blocker = await db.paymentOutboxEvent.create({
      data: {
        deduplicationKey: `payment:${id}:succeeded:v1`,
        eventType: 'TEST_BLOCKER',
        aggregateType: 'Payment',
        aggregateId: id,
        payload: {},
      },
    })
    await expect(processWebhook(event)).rejects.toThrow()
    expect((await db.payment.findUniqueOrThrow({ where: { id } })).status).toBe('PROCESSING')
    expect(await db.paymentApplication.count({ where: { paymentId: id } })).toBe(0)
    expect(
      (await db.paymentWebhookEvent.findFirstOrThrow({ where: { providerEventId: event.providerEventId } })).processed,
    ).toBe(false)
    await db.paymentOutboxEvent.delete({ where: { id: blocker.id } })
    await processWebhook(event)
    expect((await db.payment.findUniqueOrThrow({ where: { id } })).status).toBe('SUCCEEDED')
  })

  it('distinct collections remain recorded but only one can apply to a booking', async () => {
    const firstId = (await post().expect(201)).body.paymentId
    const first = await providerEvent(firstId)
    await webhook(JSON.stringify(first)).expect(200)
    await processWebhook(first)
    // Simulate a second real collection discovered by a provider, not a second public checkout.
    const snapshot = await db.payment.findUniqueOrThrow({ where: { id: firstId } })
    const secondId = randomUUID()
    await db.payment.create({
      data: {
        id: secondId,
        invoiceId,
        amount: snapshot.amount,
        currency: snapshot.currency,
        paymentGateway: snapshot.paymentGateway,
        providerEnvironment: snapshot.providerEnvironment,
        merchantAccountKey: snapshot.merchantAccountKey,
        merchantRequestRef: `payment:${secondId}`,
        requestHash: snapshot.requestHash,
        requestHashVersion: 1,
        paymentMethod: 'QR',
        idempotencyKey: randomUUID(),
      },
    })
    const second = await providerEvent(secondId)
    await provider.createPayment({
      ...provider.scope,
      merchantRequestRef: `payment:${secondId}`,
      amount: snapshot.amount.toFixed(),
      currency: snapshot.currency,
      paymentMethod: 'QR',
      expiresAt: snapshot.expiresAt!,
    })
    await webhook(JSON.stringify(second)).expect(200)
    await processWebhook(second)
    const events = await Promise.all([successEvent(firstId), successEvent(secondId)])
    await Promise.all(events.map((event) => consumer.consume(event.id)))
    expect(await db.payment.count({ where: { invoiceId, status: 'SUCCEEDED' } })).toBe(2)
    expect(await db.paymentApplication.count({ where: { invoiceId, status: 'APPLIED' } })).toBe(1)
    expect(
      await db.paymentApplication.count({ where: { invoiceId, status: 'REJECTED', reasonCode: 'DUPLICATE_PAYMENT' } }),
    ).toBe(1)
    expect(
      await db.bookingOutboxEvent.count({ where: { aggregateId: bookingId, eventType: 'BOOKING_CONFIRMED' } }),
    ).toBe(1)
    const reversal = await db.paymentOutboxEvent.findFirstOrThrow({
      where: {
        eventType: 'TECHNICAL_REVERSAL_REQUESTED',
        aggregateId: { in: [firstId, secondId] },
      },
    })
    await reversals.consume(reversal.id)
    const refund = await db.refund.findFirstOrThrow({ where: { paymentId: reversal.aggregateId } })
    await recovery.reconcileRefund(refund.id)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe('SUCCEEDED')
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('PAID')
    expect(await db.payment.count({ where: { invoiceId, status: 'SUCCEEDED' } })).toBe(2)
  })

  it('M6 resumes after refund reservation before outbox ACK without creating another reversal', async () => {
    const paymentId = (await post().expect(201)).body.paymentId
    const event = await providerEvent(paymentId)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    await db.booking.update({ where: { id: bookingId }, data: { expiresAt: new Date(0), status: 'EXPIRED' } })
    await consumer.consume((await successEvent(paymentId)).id)
    const action = `payment:${paymentId}:technical-reversal:v1`
    const reserved = await refunds.requestRefund({
      paymentId,
      purpose: 'TECHNICAL_REVERSAL',
      businessActionId: action,
      idempotencyKey: action,
      reasonCode: 'LATE_PAYMENT',
      amount: '1050',
      source: {},
    })
    const outbox = await db.paymentOutboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: `payment:${paymentId}:technical-reversal-requested:v1` },
    })
    expect(outbox.status).toBe('PENDING')
    const resumed = await reversals.consume(outbox.id)
    expect(resumed?.refundId).toBe(reserved.refundId)
    await recovery.reconcileRefund(reserved.refundId)
    expect(await db.refund.count({ where: { paymentId } })).toBe(1)
    expect((await db.refund.findUniqueOrThrow({ where: { id: reserved.refundId } })).status).toBe('SUCCEEDED')
    expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('EXPIRED')
  })

  it('M6 cannot reverse an applied payment or forge a rejected-domain decision', async () => {
    const paymentId = await confirmPayment()
    await expect(
      refunds.requestRefund({
        paymentId,
        purpose: 'TECHNICAL_REVERSAL',
        businessActionId: `payment:${paymentId}:technical-reversal:v1`,
        idempotencyKey: 'forged',
        amount: '1050',
        reasonCode: 'LATE_PAYMENT',
        source: {},
      }),
    ).rejects.toMatchObject({ code: 'REFUND_SOURCE_INVALID' })
    expect(await db.refund.count({ where: { paymentId } })).toBe(0)
  })

  const duePayment = (id: string) =>
    db.payment.update({ where: { id }, data: { nextRetryAt: new Date(0), reconcileStatus: 'SCHEDULED' } })
  const dueRefund = (id: string) =>
    db.refund.update({ where: { id }, data: { nextRetryAt: new Date(0), reconcileStatus: 'SCHEDULED' } })
  const confirmPayment = async () => {
    const id: string = (await post().expect(201)).body.paymentId
    const event = await providerEvent(id)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    await consumer.consume((await successEvent(id)).id)
    return id
  }
  const approvedCancellation = async (amount: string) => {
    await db.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
    return db.bookingCancellation.create({
      data: {
        bookingId,
        source: 'ADMIN',
        idempotencyKey: randomUUID(),
        refundableAmount: amount,
        policySnapshot: {},
        cancelledBy: userId,
      },
    })
  }
  const requestRefund = (paymentId: string, cancellationId: string, amount: string, key = randomUUID()) =>
    refunds.requestRefund({
      paymentId,
      purpose: 'BOOKING_CANCELLATION',
      businessActionId: `booking-cancellation:${cancellationId}`,
      source: { bookingCancellationId: cancellationId },
      amount,
      idempotencyKey: key,
    })

  it('M4 recovers missing webhook from durable query and applies the same booking', async () => {
    const id = (await post().expect(201)).body.paymentId
    const payment = await duePayment(id)
    await provider.setResult('PAYMENT', payment.merchantRequestRef!, 'SUCCEEDED')
    const restarted = new MockPaymentProvider(db as unknown as PrismaService)
    expect(
      (await restarted.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef! })).kind,
    ).toBe('CONFIRMED_RESULT')
    await recovery.reconcilePayment(id)
    expect(await db.payment.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'SUCCEEDED',
      reconcileStatus: 'RESOLVED',
      leaseToken: null,
    })
    await consumer.consume((await successEvent(id)).id)
    expect((await detail().expect(200)).body.status).toBe('CONFIRMED')
    expect(await db.payment.count({ where: { invoiceId } })).toBe(1)
  })

  it('M4 reserve-before-provider crash resubmits only the same reference after NOT_FOUND', async () => {
    const create = jest.spyOn(provider, 'createPayment').mockRejectedValueOnce(new Error('crash before provider'))
    const id = (await post().expect(202)).body.paymentId
    const payment = await duePayment(id)
    await recovery.reconcilePayment(id)
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0].merchantRequestRef).toBe(create.mock.calls[1][0].merchantRequestRef)
    expect((await db.payment.findUniqueOrThrow({ where: { id } })).checkoutData).not.toBeNull()
    await provider.setResult('PAYMENT', payment.merchantRequestRef!, 'SUCCEEDED')
    await duePayment(id)
    await recovery.reconcilePayment(id)
    expect((await db.payment.findUniqueOrThrow({ where: { id } })).status).toBe('SUCCEEDED')
  })

  it('M4 UNKNOWN query retains the unresolved attempt without creating another charge', async () => {
    const id = (await post().expect(201)).body.paymentId
    await duePayment(id)
    const create = jest.spyOn(provider, 'createPayment')
    jest.spyOn(provider, 'queryPayment').mockRejectedValueOnce(new Error('timeout'))
    await recovery.reconcilePayment(id)
    expect(await db.payment.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'PROCESSING',
      reconcileStatus: 'SCHEDULED',
      lastErrorCode: 'RECOVERY_UNKNOWN',
      leaseToken: null,
    })
    expect(create).not.toHaveBeenCalled()
    await post('replacement').expect(409)
  })

  it('M4 competing workers query once while lease is live', async () => {
    const id = (await post().expect(201)).body.paymentId
    await duePayment(id)
    const original = provider.queryPayment.bind(provider)
    let queried!: () => void, release!: () => void
    const started = new Promise<void>((resolve) => {
      queried = resolve
    })
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const query = jest.spyOn(provider, 'queryPayment').mockImplementation(async (input) => {
      queried()
      await blocked
      return original(input)
    })
    const first = recovery.reconcilePayment(id)
    await started
    expect(await recovery.reconcilePayment(id)).toBe(false)
    release()
    await first
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('M4 expired lease is reclaimed and stale worker cannot persist success', async () => {
    const id = (await post().expect(201)).body.paymentId
    const payment = await duePayment(id)
    const current = await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef! })
    if (current.kind !== 'CONFIRMED_RESULT') throw new Error('Expected mock state')
    let queried!: () => void, release!: () => void
    const started = new Promise<void>((resolve) => {
      queried = resolve
    })
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    jest
      .spyOn(provider, 'queryPayment')
      .mockImplementationOnce(async () => {
        queried()
        await blocked
        return { ...current, event: { ...current.event, status: 'SUCCEEDED' } }
      })
      .mockResolvedValueOnce(current)
    const stale = recovery.reconcilePayment(id)
    await started
    await db.payment.update({ where: { id }, data: { leaseUntil: new Date(0) } })
    await recovery.reconcilePayment(id)
    release()
    await stale
    expect(await db.payment.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'PROCESSING', retryCount: 2 })
    expect(await db.paymentApplication.count({ where: { paymentId: id } })).toBe(0)
  })

  it('M4 terminal correction is queried and audited without rewriting financial history', async () => {
    const id = (await post().expect(201)).body.paymentId
    const failed = await providerEvent(id, { status: 'FAILED' })
    await webhook(JSON.stringify(failed)).expect(200)
    await processWebhook(failed)
    await provider.setResult('PAYMENT', failed.merchantRequestRef!, 'SUCCEEDED')
    await duePayment(id)
    await recovery.reconcilePayment(id)
    expect((await db.payment.findUniqueOrThrow({ where: { id } })).reconcileStatus).toBe('NEEDS_REVIEW')
    await db.payment.update({ where: { id }, data: { nextRetryAt: new Date(0) } })
    await recovery.reconcilePayment(id)
    expect(await db.payment.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'FAILED',
      reconcileStatus: 'NEEDS_REVIEW',
      nextRetryAt: null,
    })
    expect(await db.auditLog.count({ where: { entityId: id, action: 'PAYMENT_AUTHORITATIVE_QUERY_REVIEW' } })).toBe(1)
  })

  it('M5 full refund executes once and reports financial state without changing collection history', async () => {
    const paymentId = await confirmPayment()
    const decision = await approvedCancellation('1050')
    const refund = await requestRefund(paymentId, decision.id, '1050', 'full')
    expect(refund.status).toBe('PENDING')
    expect((await requestRefund(paymentId, decision.id, '1050', 'another-key')).refundId).toBe(refund.refundId)
    await recovery.reconcileRefund(refund.refundId)
    expect(await db.refund.findUniqueOrThrow({ where: { id: refund.refundId } })).toMatchObject({
      status: 'SUCCEEDED',
      reconcileStatus: 'RESOLVED',
      leaseToken: null,
    })
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('REFUNDED')
    expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe('SUCCEEDED')
    expect(
      await db.paymentOutboxEvent.count({ where: { aggregateId: refund.refundId, eventType: 'REFUND_SUCCEEDED' } }),
    ).toBe(1)
    const response = await request(app.getHttpServer())
      .get(`/api/v1/refunds/${refund.refundId}`)
      .set('Authorization', `Bearer ${userId}`)
      .expect(200)
    expect(response.body).toMatchObject({ amount: '1050', status: 'SUCCEEDED' })
    expect(response.body).not.toHaveProperty('merchantRefundRef')
    await request(app.getHttpServer()).get(`/api/v1/refunds/${refund.refundId}`).expect(401)
  })

  it('M5 concurrent partial refunds cannot reserve more than actual collection', async () => {
    const paymentId = await confirmPayment()
    const a = await approvedCancellation('700'),
      b = await approvedCancellation('700')
    const results = await Promise.allSettled([
      requestRefund(paymentId, a.id, '700'),
      requestRefund(paymentId, b.id, '700'),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason.code).toBe(
      'REFUND_AMOUNT_EXCEEDED',
    )
    const reserved = await db.refund.findFirstOrThrow({ where: { paymentId } })
    await recovery.reconcileRefund(reserved.id)
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('PARTIALLY_REFUNDED')
    expect(await db.refund.count({ where: { paymentId } })).toBe(1)
  })

  it('M5 concurrent successful partial refunds aggregate to a fully refunded invoice', async () => {
    const paymentId = await confirmPayment()
    const a = await approvedCancellation('400')
    const b = await approvedCancellation('650')
    const refundsToRun = await Promise.all([
      requestRefund(paymentId, a.id, '400'),
      requestRefund(paymentId, b.id, '650'),
    ])
    await Promise.all(refundsToRun.map((refund) => recovery.reconcileRefund(refund.refundId)))
    expect(await db.refund.count({ where: { paymentId, status: 'SUCCEEDED' } })).toBe(2)
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('REFUNDED')
  })

  it('M5 timeout after provider refund recovers the same refund without a second submission', async () => {
    const paymentId = await confirmPayment()
    const decision = await approvedCancellation('400')
    const refund = await requestRefund(paymentId, decision.id, '400')
    const original = provider.refund.bind(provider)
    const submit = jest.spyOn(provider, 'refund').mockImplementationOnce(async (input) => {
      await original(input)
      throw new Error('response lost')
    })
    await recovery.reconcileRefund(refund.refundId)
    expect(await db.refund.findUniqueOrThrow({ where: { id: refund.refundId } })).toMatchObject({
      status: 'PROCESSING',
      reconcileStatus: 'SCHEDULED',
    })
    await dueRefund(refund.refundId)
    await recovery.reconcileRefund(refund.refundId)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.refundId } })).status).toBe('SUCCEEDED')
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('M5 authoritative FAILED is final even after request replay and admin query', async () => {
    const paymentId = await confirmPayment()
    const decision = await approvedCancellation('400')
    const refund = await requestRefund(paymentId, decision.id, '400')
    const original = provider.refund.bind(provider)
    const submit = jest.spyOn(provider, 'refund').mockImplementation(async (input) => {
      await original(input)
      await provider.setResult('REFUND', input.merchantRefundRef, 'FAILED')
      return provider.queryRefund(input)
    })
    await recovery.reconcileRefund(refund.refundId)
    expect((await requestRefund(paymentId, decision.id, '400')).status).toBe('FAILED')
    await dueRefund(refund.refundId)
    await recovery.reconcileRefund(refund.refundId)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.refundId } })).status).toBe('FAILED')
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('M5 signed duplicate refund callbacks update invoice totals once', async () => {
    const paymentId = await confirmPayment()
    const decision = await approvedCancellation('500')
    const created = await requestRefund(paymentId, decision.id, '500')
    const refund = await db.refund.findUniqueOrThrow({ where: { id: created.refundId } })
    const payment = await db.payment.findUniqueOrThrow({ where: { id: paymentId } })
    const event = {
      providerEventId: randomUUID(),
      kind: 'REFUND',
      merchantRequestRef: payment.merchantRequestRef,
      merchantRefundRef: refund.merchantRefundRef,
      transactionRef: payment.transactionRef,
      refundTransactionRef: `mock-refund:${refund.id}`,
      status: 'SUCCEEDED',
      amount: '500',
      currency: 'VND',
      occurredAt: new Date().toISOString(),
    }
    await Promise.all([webhook(JSON.stringify(event)).expect(200), webhook(JSON.stringify(event)).expect(200)])
    const stored = await db.paymentWebhookEvent.findFirstOrThrow({ where: { providerEventId: event.providerEventId } })
    await Promise.all([inbox.process(stored.id), inbox.process(stored.id)])
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe('SUCCEEDED')
    expect(
      await db.paymentOutboxEvent.count({ where: { aggregateId: refund.id, eventType: 'REFUND_SUCCEEDED' } }),
    ).toBe(1)
    await webhook(JSON.stringify({ ...event, amount: '501' })).expect(200)
    expect(await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({
      status: 'SUCCEEDED',
      reconcileStatus: 'NEEDS_REVIEW',
      lastErrorCode: 'PROVIDER_EVENT_PAYLOAD_CONFLICT',
    })
  })

  it('M5 USER cancellation uses policy snapshot and durable refund handoff', async () => {
    await confirmPayment()
    await db.booking.update({
      where: { id: bookingId },
      data: {
        policySnapshot: {
          cancellationRules: {
            version: 1,
            tiers: [
              { minHoursBeforeStart: 24, refundPercent: 75 },
              { minHoursBeforeStart: 0, refundPercent: 25 },
            ],
          },
        },
      },
    })
    const cancel = () =>
      request(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/cancellations`)
        .set('Authorization', `Bearer ${userId}`)
        .set('Idempotency-Key', 'cancel')
        .send({ reason: 'Plans changed' })
    const first = await cancel().expect(202)
    expect(first.body.refundableAmount).toBe('787')
    expect((await cancel().expect(202)).body.cancellationId).toBe(first.body.cancellationId)
    const refund = await cancellations.dispatch(first.body.cancellationId)
    expect(refund?.amount).toBe('787')
    await recovery.reconcileRefund(refund!.refundId)
    expect((await detail().expect(200)).body).toMatchObject({
      status: 'CANCELLED',
      refunds: [{ status: 'SUCCEEDED', amount: '787' }],
    })
  })

  it('M5 ADMIN refunds 100 percent; admin reconcile requires role and audits reason', async () => {
    const paymentId = await confirmPayment()
    await request(app.getHttpServer())
      .post(`/api/v1/admin/payments/${paymentId}/reconcile`)
      .set('Authorization', `Bearer ${userId}`)
      .send({ reason: 'Check provider' })
      .expect(403)
    await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } })
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/cancellations`)
      .set('Authorization', `Bearer ${userId}`)
      .set('Idempotency-Key', 'admin-cancel')
      .send({ reason: 'Admin decision' })
      .expect(202)
    expect(cancelled.body.refundableAmount).toBe('1050')
    await request(app.getHttpServer())
      .post(`/api/v1/admin/payments/${paymentId}/reconcile`)
      .set('Authorization', `Bearer ${userId}`)
      .send({ reason: 'Check provider' })
      .expect(202)
    expect(
      await db.auditLog.count({ where: { entityId: paymentId, action: 'PAYMENT_RECONCILE_REQUESTED', userId } }),
    ).toBe(1)
    const refund = await cancellations.dispatch(cancelled.body.cancellationId)
    await recovery.reconcileRefund(refund!.refundId)
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('REFUNDED')
  })

  it('M5 approved organizer cancellation refunds 100 percent even for their own booking', async () => {
    await confirmPayment()
    await db.trip.update({ where: { id: tripId }, data: { status: 'CANCELLED' } })
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/cancellations`)
      .set('Authorization', `Bearer ${userId}`)
      .set('Idempotency-Key', 'organizer-cancel')
      .send({ reason: 'Approved trip cancellation' })
      .expect(202)
    expect(cancelled.body.refundableAmount).toBe('1050')
    expect(
      (await db.bookingCancellation.findUniqueOrThrow({ where: { id: cancelled.body.cancellationId } })).source,
    ).toBe('ORGANIZER')
    const refund = await cancellations.dispatch(cancelled.body.cancellationId)
    await recovery.reconcileRefund(refund!.refundId)
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('REFUNDED')
  })

  it('M5 zero-percent cancellation completes without creating a zero refund', async () => {
    await confirmPayment()
    await db.booking.update({
      where: { id: bookingId },
      data: {
        policySnapshot: { cancellationRules: { version: 1, tiers: [{ minHoursBeforeStart: 0, refundPercent: 0 }] } },
      },
    })
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/cancellations`)
      .set('Authorization', `Bearer ${userId}`)
      .set('Idempotency-Key', 'zero-cancel')
      .send({ reason: 'Cancel with no refund' })
      .expect(202)
    expect(cancelled.body.refundableAmount).toBe('0')
    expect(await cancellations.dispatch(cancelled.body.cancellationId)).toBeNull()
    expect(await db.refund.count({ where: { payment: { invoiceId } } })).toBe(0)
    expect((await detail().expect(200)).body.status).toBe('CANCELLED')
  })

  it('M5 rejects missing policy, client refund amount and invalid approved sources', async () => {
    const paymentId = await confirmPayment()
    const base = () =>
      request(app.getHttpServer())
        .post(`/api/v1/bookings/${bookingId}/cancellations`)
        .set('Authorization', `Bearer ${userId}`)
        .set('Idempotency-Key', 'bad-policy')
    expect((await base().send({ reason: 'cancel' }).expect(422)).body.error.code).toBe(
      'BOOKING_CANCELLATION_POLICY_INVALID',
    )
    await base().send({ reason: 'cancel', amount: '1050' }).expect(400)
    expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('CONFIRMED')
    const decision = await approvedCancellation('100')
    await expect(requestRefund(paymentId, decision.id, '101')).rejects.toMatchObject({ code: 'REFUND_AMOUNT_EXCEEDED' })
    await expect(
      refunds.requestRefund({
        paymentId,
        purpose: 'BOOKING_CANCELLATION',
        amount: '100',
        businessActionId: 'unapproved',
        idempotencyKey: 'unapproved',
        source: { bookingCancellationId: decision.id },
      }),
    ).rejects.toMatchObject({ code: 'REFUND_SOURCE_INVALID' })
  })

  const createTrail = async (price = '500') => {
    const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId } })
    return db.systemTrail.create({
      data: {
        code: randomUUID(),
        name: 'Purchase fixture',
        destinationId: trip.destinationId,
        difficulty: 'EASY',
        distanceKm: 3,
        routeGeojson: {},
        price,
        createdBy: userId,
      },
    })
  }
  const purchaseTrail = (trailId: string, key = 'trail', body: object = { paymentMethod: 'QR' }, token = userId) =>
    request(app.getHttpServer())
      .post(`/api/v1/trails/${trailId}/purchase`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body)

  it('M7 paid purchase snapshots price and grants once; ACTIVE replay works but a new purchase is blocked', async () => {
    const trail = await createTrail()
    const created = await purchaseTrail(trail.id).expect(201)
    expect(created.body).toMatchObject({ invoiceType: 'TRAIL_ACCESS', amount: '500', accessStatus: 'PENDING_PAYMENT' })
    const paymentId = created.body.paymentId
    await db.systemTrail.update({ where: { id: trail.id }, data: { price: 900 } })
    expect((await purchaseTrail(trail.id).expect(200)).body.paymentId).toBe(paymentId)
    const event = await providerEvent(paymentId)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    const outbox = await successEvent(paymentId)
    await Promise.all([trailConsumer.consume(outbox.id), trailConsumer.consume(outbox.id)])
    expect(await db.trailAccess.findUniqueOrThrow({ where: { id: created.body.trailAccessId } })).toMatchObject({
      status: 'ACTIVE',
    })
    expect((await purchaseTrail(trail.id).expect(200)).body).toMatchObject({
      paymentId,
      accessStatus: 'ACTIVE',
      amount: '500',
    })
    await purchaseTrail(trail.id, 'new').expect(409)
    await purchaseTrail(trail.id, 'trail', { paymentMethod: 'REDIRECT' }).expect(409)
    expect(
      await db.paymentOutboxEvent.count({
        where: { aggregateId: created.body.trailAccessId, eventType: 'TRAIL_ACCESS_ACTIVATED' },
      }),
    ).toBe(1)
    expect(await db.payment.count({ where: { invoiceId: created.body.invoiceId } })).toBe(1)
    expect(await db.paymentConsumerReceipt.count({ where: { eventId: outbox.id } })).toBe(1)
  })

  it('M7 free purchase grants once without any invoice or fake payment and persists replay', async () => {
    const trail = await createTrail('0')
    const [a, b] = await Promise.all([purchaseTrail(trail.id), purchaseTrail(trail.id)])
    expect([a.status, b.status].sort()).toEqual([200, 201])
    expect(a.body).toMatchObject({ accessStatus: 'ACTIVE', paymentId: null, invoiceId: null, amount: '0' })
    expect(a.body.trailAccessId).toBe(b.body.trailAccessId)
    expect(await db.invoice.count({ where: { trailAccessId: a.body.trailAccessId } })).toBe(0)
    expect(
      await db.auditLog.count({ where: { entityId: a.body.trailAccessId, action: 'TRAIL_ACCESS_FREE_GRANTED' } }),
    ).toBe(1)
    await db.systemTrail.update({ where: { id: trail.id }, data: { price: 700 } })
    expect((await purchaseTrail(trail.id).expect(200)).body.amount).toBe('0')
    await purchaseTrail(trail.id, 'new').expect(409)
    await purchaseTrail(trail.id, 'trail', { paymentMethod: 'REDIRECT' }).expect(409)
  })

  it('M7 concurrent paid purchases share one source/invoice and only one open payment', async () => {
    const trail = await createTrail()
    const [a, b] = await Promise.all([purchaseTrail(trail.id, 'a'), purchaseTrail(trail.id, 'b')])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    const access = await db.trailAccess.findUniqueOrThrow({
      where: { userId_systemTrailId: { userId, systemTrailId: trail.id } },
    })
    expect(await db.invoice.count({ where: { trailAccessId: access.id } })).toBe(1)
    expect(await db.payment.count({ where: { invoice: { trailAccessId: access.id } } })).toBe(1)
    await expect(
      db.invoice.create({
        data: {
          invoiceNo: randomUUID(),
          invoiceType: 'TRAIL_ACCESS',
          userId,
          trailAccessId: access.id,
          revisionNo: 2,
          subtotalAmount: 500,
          totalAmount: 500,
          status: 'PENDING_PAYMENT',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
    await expect(
      db.invoice.create({
        data: {
          invoiceNo: randomUUID(),
          invoiceType: 'TRAIL_ACCESS',
          userId,
          trailAccessId: access.id,
          revisionNo: 1,
          subtotalAmount: 500,
          totalAmount: 500,
          status: 'CANCELLED',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('M7 same client key is isolated per authenticated buyer', async () => {
    const trail = await createTrail()
    const other = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@payment.test`, fullName: 'Other buyer' },
    })
    tokens.set(other.id, { id: other.authUserId, email: other.email })
    const first = (await purchaseTrail(trail.id).expect(201)).body
    const second = (await purchaseTrail(trail.id, 'trail', { paymentMethod: 'QR' }, other.id).expect(201)).body
    expect(first.trailAccessId).not.toBe(second.trailAccessId)
    expect(first.paymentId).not.toBe(second.paymentId)
    const access = await db.trailAccess.findUniqueOrThrow({ where: { id: second.trailAccessId } })
    expect(access.userId).toBe(other.id)
  })

  it('M7 failed checkout retries against the same invoice and original snapshot', async () => {
    const trail = await createTrail()
    const first = (await purchaseTrail(trail.id).expect(201)).body
    const failure = await providerEvent(first.paymentId, { status: 'FAILED' })
    await webhook(JSON.stringify(failure)).expect(200)
    await processWebhook(failure)
    await db.systemTrail.update({ where: { id: trail.id }, data: { price: 0 } })
    const second = (await purchaseTrail(trail.id, 'retry').expect(201)).body
    expect(second).toMatchObject({ invoiceId: first.invoiceId, trailAccessId: first.trailAccessId, amount: '500' })
    expect(second.paymentId).not.toBe(first.paymentId)
    expect((await purchaseTrail(trail.id).expect(200)).body).toMatchObject({
      paymentId: first.paymentId,
      status: 'FAILED',
    })
  })

  it('M7 missing webhook recovers through the shared worker and activates trail access', async () => {
    const trail = await createTrail()
    const created = (await purchaseTrail(trail.id).expect(201)).body
    const payment = await duePayment(created.paymentId)
    await provider.setResult('PAYMENT', payment.merchantRequestRef!, 'SUCCEEDED')
    await recovery.reconcilePayment(payment.id)
    for (let i = 0; i < 5; i++) {
      await worker.tick()
      if ((await db.trailAccess.findUniqueOrThrow({ where: { id: created.trailAccessId } })).status === 'ACTIVE') break
    }
    expect((await db.trailAccess.findUniqueOrThrow({ where: { id: created.trailAccessId } })).status).toBe('ACTIVE')
  })

  it('M7 trail deactivation during checkout rejects grant and reverses actual collection', async () => {
    const trail = await createTrail()
    const created = (await purchaseTrail(trail.id).expect(201)).body
    await db.systemTrail.update({ where: { id: trail.id }, data: { status: 'INACTIVE' } })
    const event = await providerEvent(created.paymentId)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    await trailConsumer.consume((await successEvent(created.paymentId)).id)
    expect(await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: created.paymentId } })).toMatchObject({
      status: 'REJECTED',
      reasonCode: 'DOMAIN_NOT_ELIGIBLE',
    })
    const outbox = await db.paymentOutboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: `payment:${created.paymentId}:technical-reversal-requested:v1` },
    })
    const refund = await reversals.consume(outbox.id)
    await recovery.reconcileRefund(refund!.refundId)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund!.refundId } })).status).toBe('SUCCEEDED')
    expect((await db.trailAccess.findUniqueOrThrow({ where: { id: created.trailAccessId } })).status).toBe(
      'PENDING_PAYMENT',
    )
    expect((await db.invoice.findUniqueOrThrow({ where: { id: created.invoiceId } })).status).toBe('PENDING_PAYMENT')
  })

  it('M7 grant rollback keeps application pending and retries atomically', async () => {
    const trail = await createTrail()
    const created = (await purchaseTrail(trail.id).expect(201)).body
    const event = await providerEvent(created.paymentId)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    const outbox = await successEvent(created.paymentId)
    const blocker = await db.paymentOutboxEvent.create({
      data: {
        deduplicationKey: `trail-access:${created.trailAccessId}:activated:v1`,
        eventType: 'TEST_BLOCKER',
        aggregateType: 'TrailAccess',
        aggregateId: created.trailAccessId,
        payload: {},
      },
    })
    await expect(trailConsumer.consume(outbox.id)).rejects.toThrow()
    expect((await db.trailAccess.findUniqueOrThrow({ where: { id: created.trailAccessId } })).status).toBe(
      'PENDING_PAYMENT',
    )
    expect((await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: created.paymentId } })).status).toBe(
      'PENDING',
    )
    await db.paymentOutboxEvent.delete({ where: { id: blocker.id } })
    await trailConsumer.consume(outbox.id)
    expect((await db.trailAccess.findUniqueOrThrow({ where: { id: created.trailAccessId } })).status).toBe('ACTIVE')
  })

  it('M7 authenticates and rejects client pricing and inactive trails through shared error contract', async () => {
    const trail = await createTrail()
    await request(app.getHttpServer())
      .post(`/api/v1/trails/${trail.id}/purchase`)
      .send({ paymentMethod: 'QR' })
      .expect(401)
    const bad = await purchaseTrail(trail.id, 'bad', { paymentMethod: 'QR', amount: '1', userId: randomUUID() }).expect(
      400,
    )
    expect(bad.body.error.code).toBe('VALIDATION_ERROR')
    expect(bad.body.meta.contractVersion).toBe('0.2.0-final-flow')
    await db.systemTrail.update({ where: { id: trail.id }, data: { status: 'INACTIVE' } })
    expect((await purchaseTrail(trail.id).expect(409)).body.error.code).toBe('PAYMENT_INVALID_STATE')
    expect(await db.trailAccess.count({ where: { systemTrailId: trail.id } })).toBe(0)
  })

  const makeRental = async (quantity = 2, fee = 100, deposit = 500) => {
    await confirmPayment()
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } })
    const policy = await db.rentalPolicy.create({
      data: {
        policyCode: randomUUID(),
        versionNo: 1,
        quoteTtlMinutes: 15,
        cutoffHoursBeforeTrip: 1,
        cancellationRules: {},
        effectiveFrom: new Date(),
      },
    })
    const category = await db.rentalCategory.create({ data: { name: 'Payment fixture', slug: randomUUID() } })
    const product = await db.rentalProduct.create({
      data: {
        categoryId: category.id,
        sku: randomUUID(),
        name: 'Tent',
        dailyPrice: fee,
        replacementValue: 1000,
        depositValue: deposit,
      },
    })
    const common = {
      userId,
      tripId,
      bookingId,
      rentalPolicyId: policy.id,
      recipientSnapshot: {},
      rentalStartAt: new Date('2035-01-01'),
      rentalEndAt: new Date('2035-01-02'),
      rentalFee: fee * quantity,
      totalDeposit: deposit * quantity,
      totalAmount: (fee + deposit) * quantity,
      policySnapshot: {},
    }
    const quote = await db.rentalQuote.create({
      data: { ...common, contextVersion: 1, expiresAt: new Date(Date.now() + 900000) },
    })
    const order = await db.rentalOrder.create({
      data: {
        ...common,
        quoteId: quote.id,
        contextVersionSnapshot: 1,
        pickupPointId: booking.pickupPointId,
        returnPointId: booking.returnPointId,
        occupiedStartAt: common.rentalStartAt,
        occupiedEndAt: common.rentalEndAt,
        paymentExpiresAt: new Date(Date.now() + 900000),
        rentalOrderLinesViaOrderId: {
          create: {
            productId: product.id,
            quantity,
            dailyPriceSnapshot: fee,
            depositPerUnitSnapshot: deposit,
            replacementValueSnapshot: 1000,
            chargedDays: 1,
            lineRentalFee: fee * quantity,
            lineDeposit: deposit * quantity,
          },
        },
      },
      include: { rentalOrderLinesViaOrderId: true },
    })
    const line = order.rentalOrderLinesViaOrderId[0]
    await db.rentalQuantityReservation.create({
      data: {
        orderLineId: line.id,
        productId: product.id,
        quantity,
        occupiedFrom: order.occupiedStartAt,
        occupiedUntil: order.occupiedEndAt,
        holdExpiresAt: order.paymentExpiresAt,
      },
    })
    return { order, line, product, policy }
  }
  const rentalCheckout = (id: string, key = 'rental', body: object = { paymentMethod: 'QR' }, token = userId) =>
    request(app.getHttpServer())
      .post(`/api/v1/rental-orders/${id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(body)
  const payRental = async (fixture: Awaited<ReturnType<typeof makeRental>>) => {
    const result = (await rentalCheckout(fixture.order.id).expect(201)).body
    const event = await providerEvent(result.paymentId)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    const outbox = await successEvent(result.paymentId)
    await rentalConsumer.consume(outbox.id)
    return result
  }
  const approvedItems = async (f: Awaited<ReturnType<typeof makeRental>>, amounts: number[]) => {
    await db.rentalOrder.update({ where: { id: f.order.id }, data: { status: 'RETURN_PROCESSING' } })
    const settlement = await db.depositSettlement.create({
      data: {
        orderId: f.order.id,
        rentalPolicyId: f.policy.id,
        idempotencyKey: randomUUID(),
        totalDeposit: f.order.totalDeposit,
        policySnapshot: {},
      },
    })
    const location = await db.inventoryLocation.create({
      data: { code: randomUUID(), name: 'Fixture', address: 'Fixture' },
    })
    const items = []
    for (const amount of amounts) {
      const unit = await db.equipmentUnit.create({
        data: { productId: f.product.id, homeInventoryLocationId: location.id, assetCode: randomUUID() },
      })
      const assignment = await db.rentalUnitAssignment.create({
        data: { orderLineId: f.line.id, equipmentUnitId: unit.id, status: 'RETURNED', returnedAt: new Date() },
      })
      const inspection = await db.returnInspection.create({
        data: {
          orderId: f.order.id,
          assignmentId: assignment.id,
          unitId: unit.id,
          inspectorId: userId,
          stage: 'FINAL',
          outcome: amount === 500 ? 'NORMAL' : 'DAMAGE_CONFIRMED',
        },
      })
      items.push(
        await db.depositSettlementItem.create({
          data: {
            settlementId: settlement.id,
            assignmentId: assignment.id,
            unitId: unit.id,
            inspectionId: inspection.id,
            depositAmount: f.line.depositPerUnitSnapshot,
            deductionAmount: f.line.depositPerUnitSnapshot.minus(amount),
            refundAmount: amount,
            status: 'DEDUCTION_APPROVED',
            approvedBy: userId,
            approvedAt: new Date(),
            decisionSnapshot: { approved: true },
            outcome:
              amount === 0
                ? 'FULL_DEDUCTION'
                : f.line.depositPerUnitSnapshot.equals(amount)
                  ? 'FULL_REFUND'
                  : 'PARTIAL_REFUND',
          },
        }),
      )
    }
    return { settlement, items }
  }
  const applyRefund = async (id: string) => {
    await recovery.reconcileRefund(id)
    const event = await db.paymentOutboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: `refund:${id}:succeeded:v1` },
    })
    await Promise.all([deposits.consume(event.id), deposits.consume(event.id)])
  }

  it('M8 reserves line/component allocations, replays checkout and applies Rental once with quantity holds', async () => {
    const f = await makeRental()
    const first = (await rentalCheckout(f.order.id).expect(201)).body
    expect(first).toMatchObject({ invoiceType: 'RENTAL', amount: '1200' })
    expect((await rentalCheckout(f.order.id).expect(200)).body.paymentId).toBe(first.paymentId)
    await rentalCheckout(f.order.id, 'rental', { paymentMethod: 'REDIRECT' }).expect(409)
    await rentalCheckout(f.order.id, 'another').expect(409)
    const allocations = await db.paymentAllocation.findMany({ where: { paymentId: first.paymentId } })
    expect(allocations.map((a) => [a.component, a.amount.toFixed()]).sort()).toEqual([
      ['RENTAL_DEPOSIT', '1000'],
      ['RENTAL_FEE', '200'],
    ])
    const event = await providerEvent(first.paymentId)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    const outbox = await successEvent(first.paymentId)
    await Promise.all([rentalConsumer.consume(outbox.id), rentalConsumer.consume(outbox.id)])
    expect(await db.rentalOrder.findUniqueOrThrow({ where: { id: f.order.id } })).toMatchObject({
      status: 'PAID',
      financialStatus: 'PAID',
    })
    expect((await db.rentalQuantityReservation.findFirstOrThrow({ where: { orderLineId: f.line.id } })).status).toBe(
      'CONFIRMED',
    )
    expect(await db.rentalOutboxEvent.count({ where: { aggregateId: f.order.id, eventType: 'RENTAL_PAID' } })).toBe(1)
    expect((await rentalCheckout(f.order.id).expect(200)).body.paymentId).toBe(first.paymentId)
  })

  it('M8 partial item refunds serialize on the same deposit component and retain damage and rental fees', async () => {
    const f = await makeRental(),
      payment = await payRental(f)
    const { settlement, items } = await approvedItems(f, [400, 500])
    const [a, b] = await Promise.all(items.map((i) => deposits.dispatch(i.id)))
    expect((await deposits.dispatch(items[0].id)).refundId).toBe(a.refundId)
    await Promise.all([applyRefund(a.refundId), applyRefund(b.refundId)])
    expect((await db.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } })).status).toBe('PARTIALLY_REFUNDED')
    expect(await db.depositSettlement.findUniqueOrThrow({ where: { id: settlement.id } })).toMatchObject({
      status: 'SETTLED',
      outcome: 'PARTIAL_REFUND',
    })
    const summary = await db.depositSettlement.findUniqueOrThrow({ where: { id: settlement.id } })
    expect(summary.refundAmount.toFixed()).toBe('900')
    expect(summary.totalDeduction.toFixed()).toBe('100')
    expect((await db.rentalOrder.findUniqueOrThrow({ where: { id: f.order.id } })).financialStatus).toBe(
      'PARTIALLY_REFUNDED',
    )
    const allocated = await db.refundAllocation.findMany({
      where: { refund: { paymentId: payment.paymentId } },
      include: { paymentAllocation: true },
    })
    expect(allocated).toHaveLength(2)
    expect(allocated.every((a) => a.paymentAllocation.component === 'RENTAL_DEPOSIT')).toBe(true)
    expect(
      await db.rentalOutboxEvent.count({
        where: { aggregateId: { in: items.map((i) => i.id) }, eventType: 'DEPOSIT_REFUND_SUCCEEDED' },
      }),
    ).toBe(2)
  })

  it('M8 rejects fee-component, unapproved and overstated item refunds while retaining a reviewed sibling', async () => {
    const f = await makeRental(),
      payment = await payRental(f)
    const { settlement, items } = await approvedItems(f, [400, 500])
    await db.depositSettlementItem.update({
      where: { id: items[1].id },
      data: { status: 'REVIEW_REQUIRED', approvedAt: null, approvedBy: null },
    })
    await expect(deposits.dispatch(items[1].id)).rejects.toMatchObject({ code: 'REFUND_SOURCE_INVALID' })
    const fee = await db.paymentAllocation.findFirstOrThrow({
      where: { paymentId: payment.paymentId, component: 'RENTAL_FEE' },
    })
    const deposit = await db.paymentAllocation.findFirstOrThrow({
      where: { paymentId: payment.paymentId, component: 'RENTAL_DEPOSIT' },
    })
    const command = {
      paymentId: payment.paymentId,
      purpose: 'DEPOSIT' as const,
      businessActionId: `deposit-item:${items[0].id}:refund:v1`,
      amount: '400',
      idempotencyKey: 'invalid',
      source: { depositSettlementId: settlement.id, depositSettlementItemId: items[0].id },
      allocations: [{ paymentAllocationId: fee.id, amount: '400' }],
    }
    await expect(refunds.requestRefund(command)).rejects.toMatchObject({ code: 'REFUND_SOURCE_INVALID' })
    await expect(
      refunds.requestRefund({
        ...command,
        amount: '500',
        allocations: [{ paymentAllocationId: deposit.id, amount: '500' }],
      }),
    ).rejects.toMatchObject({ code: 'REFUND_SOURCE_INVALID' })
    const valid = await deposits.dispatch(items[0].id)
    await applyRefund(valid.refundId)
    expect((await db.depositSettlementItem.findUniqueOrThrow({ where: { id: items[1].id } })).status).toBe(
      'REVIEW_REQUIRED',
    )
    expect((await db.depositSettlement.findUniqueOrThrow({ where: { id: settlement.id } })).status).toBe(
      'ACTION_REQUIRED',
    )
  })

  it('M8 timeout retains item/component reservation and recovery completes the same refund', async () => {
    const f = await makeRental(1),
      payment = await payRental(f)
    const { items } = await approvedItems(f, [500])
    const refund = await deposits.dispatch(items[0].id)
    const original = provider.refund.bind(provider)
    const submit = jest.spyOn(provider, 'refund').mockImplementationOnce(async (input) => {
      await original(input)
      throw new Error('lost response')
    })
    await recovery.reconcileRefund(refund.refundId)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.refundId } })).status).toBe('PROCESSING')
    expect((await deposits.dispatch(items[0].id)).refundId).toBe(refund.refundId)
    await dueRefund(refund.refundId)
    await applyRefund(refund.refundId)
    expect(submit).toHaveBeenCalledTimes(1)
    expect((await db.depositSettlementItem.findUniqueOrThrow({ where: { id: items[0].id } })).status).toBe('SETTLED')
    expect((await db.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } })).status).toBe('PARTIALLY_REFUNDED')
  })

  it('M8 authoritative failed deposit remains failed with no retry or new item refund', async () => {
    const f = await makeRental(1)
    await payRental(f)
    const { items, settlement } = await approvedItems(f, [500])
    const refund = await deposits.dispatch(items[0].id)
    const original = provider.refund.bind(provider)
    const submit = jest.spyOn(provider, 'refund').mockImplementation(async (input) => {
      await original(input)
      await provider.setResult('REFUND', input.merchantRefundRef, 'FAILED')
      return provider.queryRefund(input)
    })
    await recovery.reconcileRefund(refund.refundId)
    const event = await db.paymentOutboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: `refund:${refund.refundId}:failed:v1` },
    })
    await deposits.consume(event.id)
    expect((await deposits.dispatch(items[0].id)).status).toBe('FAILED')
    await dueRefund(refund.refundId)
    await recovery.reconcileRefund(refund.refundId)
    expect(submit).toHaveBeenCalledTimes(1)
    expect((await db.depositSettlementItem.findUniqueOrThrow({ where: { id: items[0].id } })).status).toBe(
      'REFUND_FAILED',
    )
    expect((await db.depositSettlement.findUniqueOrThrow({ where: { id: settlement.id } })).status).toBe(
      'ACTION_REQUIRED',
    )
  })

  it('M8 late Rental collection reverses every component without confirming an expired order', async () => {
    const f = await makeRental(),
      payment = (await rentalCheckout(f.order.id).expect(201)).body
    await db.rentalOrder.update({
      where: { id: f.order.id },
      data: { status: 'EXPIRED', paymentExpiresAt: new Date(0) },
    })
    const event = await providerEvent(payment.paymentId)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    await rentalConsumer.consume((await successEvent(payment.paymentId)).id)
    const reversal = await db.paymentOutboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: `payment:${payment.paymentId}:technical-reversal-requested:v1` },
    })
    const refund = await reversals.consume(reversal.id)
    await recovery.reconcileRefund(refund!.refundId)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund!.refundId } })).status).toBe('SUCCEEDED')
    expect(await db.refundAllocation.count({ where: { refundId: refund!.refundId } })).toBe(2)
    expect(
      (
        await db.refundAllocation.aggregate({ where: { refundId: refund!.refundId }, _sum: { amount: true } })
      )._sum.amount?.toFixed(),
    ).toBe('1200')
    expect((await db.rentalOrder.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe('EXPIRED')
    expect((await db.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } })).status).toBe('PENDING_PAYMENT')
  })

  it('M8 full deduction settles once without creating a zero refund', async () => {
    const f = await makeRental(1),
      payment = await payRental(f)
    const { items, settlement } = await approvedItems(f, [0])
    expect(await deposits.dispatch(items[0].id)).toBeNull()
    expect(await deposits.dispatch(items[0].id)).toBeNull()
    expect(await db.refund.count({ where: { paymentId: payment.paymentId } })).toBe(0)
    expect(await db.depositSettlement.findUniqueOrThrow({ where: { id: settlement.id } })).toMatchObject({
      status: 'SETTLED',
      outcome: 'FULL_DEDUCTION',
    })
    expect((await db.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } })).status).toBe('PAID')
    expect(
      await db.rentalOutboxEvent.count({ where: { aggregateId: items[0].id, eventType: 'DEPOSIT_RETAINED' } }),
    ).toBe(1)
  })

  it('M8 concurrent requests for one item reserve one refund and settlement rollback retries safely', async () => {
    const f = await makeRental(1)
    await payRental(f)
    const { items } = await approvedItems(f, [500])
    const [a, b] = await Promise.all([deposits.dispatch(items[0].id), deposits.dispatch(items[0].id)])
    expect(a!.refundId).toBe(b!.refundId)
    await recovery.reconcileRefund(a!.refundId)
    const event = await db.paymentOutboxEvent.findUniqueOrThrow({
      where: { deduplicationKey: `refund:${a!.refundId}:succeeded:v1` },
    })
    const blocker = await db.rentalOutboxEvent.create({
      data: {
        deduplicationKey: `deposit-item:${items[0].id}:succeeded:v1`,
        eventType: 'TEST_BLOCKER',
        aggregateType: 'DepositSettlementItem',
        aggregateId: items[0].id,
        payload: {},
      },
    })
    await expect(deposits.consume(event.id)).rejects.toThrow()
    expect((await db.depositSettlementItem.findUniqueOrThrow({ where: { id: items[0].id } })).status).toBe(
      'REFUND_PENDING',
    )
    expect((await db.refund.findUniqueOrThrow({ where: { id: a!.refundId } })).status).toBe('SUCCEEDED')
    await db.rentalOutboxEvent.delete({ where: { id: blocker.id } })
    await deposits.consume(event.id)
    expect((await db.depositSettlementItem.findUniqueOrThrow({ where: { id: items[0].id } })).status).toBe('SETTLED')
  })

  it('M8 refuses checkout after a quantity hold expires', async () => {
    const f = await makeRental()
    await db.rentalQuantityReservation.updateMany({
      where: { orderLineId: f.line.id },
      data: { holdExpiresAt: new Date(0) },
    })
    expect((await rentalCheckout(f.order.id).expect(409)).body.error.code).toBe('PAYMENT_INVALID_STATE')
    expect(await db.payment.count({ where: { invoice: { rentalOrderId: f.order.id } } })).toBe(0)
  })

  it('M8 zero total uses no financial success placeholder', async () => {
    const f = await makeRental(1, 0, 0)
    await rentalCheckout(f.order.id).expect(422)
    expect(await db.payment.count({ where: { invoice: { rentalOrderId: f.order.id } } })).toBe(0)
  })

  it('M8 rejects public pricing, non-owner access and mismatched order totals', async () => {
    const f = await makeRental()
    await request(app.getHttpServer())
      .post(`/api/v1/rental-orders/${f.order.id}/payments`)
      .send({ paymentMethod: 'QR' })
      .expect(401)
    expect(
      (await rentalCheckout(f.order.id, 'bad', { paymentMethod: 'QR', amount: '1' }).expect(400)).body.error.code,
    ).toBe('VALIDATION_ERROR')
    const other = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@payment.test`, fullName: 'Other' },
    })
    tokens.set(other.id, { id: other.authUserId, email: other.email })
    await rentalCheckout(f.order.id, 'other', { paymentMethod: 'QR' }, other.id).expect(404)
    await db.rentalOrder.update({ where: { id: f.order.id }, data: { totalAmount: 1201 } })
    expect((await rentalCheckout(f.order.id).expect(422)).body.error.code).toBe('PAYMENT_AMOUNT_MISMATCH')
    expect(await db.payment.count({ where: { invoice: { rentalOrderId: f.order.id } } })).toBe(0)
  })

  it('M8 zero components are omitted and no zero-total payment is manufactured', async () => {
    const f = await makeRental(1, 100, 0)
    const payment = (await rentalCheckout(f.order.id).expect(201)).body
    expect(await db.paymentAllocation.count({ where: { paymentId: payment.paymentId } })).toBe(1)
    expect((await db.paymentAllocation.findFirstOrThrow({ where: { paymentId: payment.paymentId } })).component).toBe(
      'RENTAL_FEE',
    )
    await expect(
      db.paymentAllocation.create({
        data: { paymentId: payment.paymentId, rentalOrderLineId: f.line.id, component: 'RENTAL_DEPOSIT', amount: 0 },
      }),
    ).rejects.toThrow()
  })

  it('expiry wins while application waits for the Trip lock', async () => {
    const id = (await post().expect(201)).body.paymentId
    const event = await providerEvent(id)
    await webhook(JSON.stringify(event)).expect(200)
    await processWebhook(event)
    const outbox = await successEvent(id)
    let release!: () => void
    let locked!: () => void
    const lockedSignal = new Promise<void>((resolve) => {
      locked = resolve
    })
    const releaseSignal = new Promise<void>((resolve) => {
      release = resolve
    })
    const expiry = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
      await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${bookingId}::uuid FOR UPDATE`
      locked()
      await releaseSignal
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'EXPIRED', expiresAt: new Date(0) } })
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: 'EXPIRED' } })
    })
    await lockedSignal
    const applying = consumer.consume(outbox.id)
    release()
    await Promise.all([expiry, applying])
    expect((await db.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe('EXPIRED')
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).status).toBe('EXPIRED')
    expect((await db.paymentApplication.findUniqueOrThrow({ where: { paymentId: id } })).reasonCode).toBe(
      'LATE_PAYMENT',
    )
  })
})
