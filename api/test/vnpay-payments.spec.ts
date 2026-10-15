import { createHmac, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { GlobalErrorFilter } from '../src/shared/errors'
import { PrismaService } from '../src/shared/services/prisma.service'
import { PaymentProvider, ProviderPaymentInput } from '../src/modules/payments/payment-provider.port'
import { PaymentProviderRouter } from '../src/modules/payments/payment-provider.router'
import { VnpayPaymentProvider } from '../src/modules/payments/vnpay-payment.provider'
import { MomoPaymentProvider } from '../src/modules/payments/momo-payment.provider'
import { MockPaymentProvider } from '../src/modules/payments/mock-payment.provider'
import { VnpayIpnController } from '../src/modules/payments/vnpay-ipn.controller'
import { PaymentsController, PaymentOptionsController } from '../src/modules/payments/payments.controller'
import { PaymentsService } from '../src/modules/payments/payments.service'
import { PaymentWebhooksController } from '../src/modules/payments/payment-webhooks.controller'
import { PaymentWebhooksService } from '../src/modules/payments/payment-webhooks.service'
import { RefundsService } from '../src/modules/payments/refunds.service'
import { RentalCheckoutService } from '../src/modules/rental/payments/rental-checkout.service'
import { PaymentRecoveryService } from '../src/modules/payments/payment-recovery.service'

// Wire/HTTP tests with a storage stub. PostgreSQL concurrency and financial
// application remain covered by payments.spec.ts on an isolated test database.
describe('VNPAY collection and concurrent gateway routing', () => {
  const original = { ...process.env }
  const secret = 'test-vnpay-secret'
  let app: INestApplication, vnpay: VnpayPaymentProvider, momo: MomoPaymentProvider
  let router: PaymentProviderRouter, inbox: PaymentWebhooksService, db: any
  let input: ProviderPaymentInput, bookingId: string, userId: string
  const rows = new Map<string, any>(),
    events = new Map<string, any>()
  // Independent implementation of the documented form-encoded HMAC wire input.
  const sign = (data: Record<string, string>) =>
    createHmac('sha512', secret)
      .update(
        Object.keys(data)
          .filter((key) => !['vnp_SecureHash', 'vnp_SecureHashType'].includes(key))
          .sort()
          .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}`)
          .join('&'),
      )
      .digest('hex')
  const notification = (extra: Record<string, string> = {}) => {
    const data = {
      vnp_TmnCode: 'TEST1234',
      vnp_Amount: '1000000',
      vnp_TxnRef: input.merchantRequestRef.slice(8).replace(/-/g, ''),
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '123456789',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'Thanh toan TrekGo',
      vnp_PayDate: '20261015120000',
      ...extra,
    }
    return { ...data, vnp_SecureHash: sign(data) }
  }
  const ipn = (data = notification()) => request(app.getHttpServer()).get('/api/v1/payments/webhooks/vnpay').query(data)
  const checkout = (gateway: string, key = randomUUID()) =>
    request(app.getHttpServer())
      .post(`/api/v1/bookings/${bookingId}/payments`)
      .set('Idempotency-Key', key)
      .send({ paymentMethod: 'REDIRECT', gateway })

  beforeEach(async () => {
    Object.assign(process.env, {
      PAYMENT_PROVIDER: 'mock',
      PAYMENT_PROVIDER_ENVIRONMENT: 'SANDBOX',
      PAYMENT_ENABLED_PROVIDERS: 'momo,vnpay',
      VNPAY_SANDBOX_TMN_CODE: 'TEST1234',
      VNPAY_SANDBOX_HASH_SECRET: secret,
      VNPAY_SANDBOX_RETURN_URL: 'http://localhost:5000/bookings',
      MOMO_SANDBOX_PARTNER_CODE: 'MOMO_TEST',
      MOMO_SANDBOX_ACCESS_KEY: 'momo-access',
      MOMO_SANDBOX_SECRET_KEY: 'momo-secret',
      MOMO_SANDBOX_IPN_URL: 'https://merchant.test/api/v1/payments/webhooks/momo',
      MOMO_SANDBOX_REDIRECT_URL: 'http://localhost:5000/bookings',
    })
    delete process.env.PAYMENT_PROVIDER_TIMEOUT_SECONDS
    delete process.env.PAYMENT_RECOVERY_LEASE_SECONDS
    rows.clear()
    events.clear()
    bookingId = randomUUID()
    userId = randomUUID()
    const invoiceId = randomUUID(),
      expiresAt = new Date(Date.now() + 900000)
    const amount = new Prisma.Decimal(10000)
    const booking = {
      id: bookingId,
      userId,
      tripId: randomUUID(),
      status: 'PENDING_PAYMENT',
      expiresAt,
      currency: 'VND',
      totalAmount: amount,
      subtotalAmount: amount,
      insuranceAmount: new Prisma.Decimal(0),
      discountAmount: new Prisma.Decimal(0),
      trip: { tripType: 'PUBLIC', status: 'OPEN', startAt: new Date(Date.now() + 86400000) },
    }
    const invoice = {
      id: invoiceId,
      bookingId,
      userId,
      invoiceType: 'BOOKING',
      status: 'PENDING_PAYMENT',
      revisionNo: 1,
      expiresAt,
      currency: 'VND',
      totalAmount: amount,
      subtotalAmount: amount,
      discountAmount: new Prisma.Decimal(0),
      invoiceLinesViaInvoiceId: [{ unitAmount: amount, lineAmount: amount, quantity: new Prisma.Decimal(1) }],
    }
    db = {
      $queryRaw: jest.fn().mockImplementation(() => Promise.resolve([{ now: new Date() }])),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn().mockImplementation((fn) => fn(db)),
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        findUniqueOrThrow: jest.fn().mockResolvedValue(booking),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(invoice),
        findUniqueOrThrow: jest.fn().mockResolvedValue(invoice),
      },
      payment: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve(
              [...rows.values()].find((row) =>
                Object.entries(where).every(([key, value]: [string, any]) =>
                  key === 'status' && value.in ? value.in.includes(row[key]) : row[key] === value,
                ),
              ) ?? null,
            ),
          ),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve(
              [...rows.values()].find((row) =>
                where.id ? row.id === where.id : row.idempotencyKey === where.idempotencyKey,
              ) ?? null,
            ),
          ),
        findUniqueOrThrow: jest.fn().mockImplementation(({ where }) => Promise.resolve(rows.get(where.id))),
        create: jest.fn().mockImplementation(({ data }) => {
          const row = { ...data, invoice, status: 'PENDING', version: 1 }
          rows.set(row.id, row)
          return Promise.resolve(row)
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          const row = rows.get(where.id)
          Object.assign(row, data, { version: row.version + 1 })
          return Promise.resolve({ count: 1 })
        }),
      },
      paymentWebhookEvent: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }) => Promise.resolve(events.get(where.providerEventId) ?? null)),
        create: jest.fn().mockImplementation(({ data }) => {
          events.set(data.providerEventId, data)
          return Promise.resolve(data)
        }),
      },
    }
    vnpay = new VnpayPaymentProvider()
    momo = new MomoPaymentProvider(db)
    router = new PaymentProviderRouter([new MockPaymentProvider(db), momo, vnpay], 'mock')
    input = {
      ...vnpay.scope,
      merchantRequestRef: `payment:${randomUUID()}`,
      amount: '10000',
      currency: 'VND',
      paymentMethod: 'REDIRECT',
      expiresAt,
      clientIp: '::ffff:127.0.0.1',
      returnPath: `/bookings/${bookingId}`,
    }
    const module = await Test.createTestingModule({
      controllers: [VnpayIpnController, PaymentsController, PaymentOptionsController, PaymentWebhooksController],
      providers: [
        PaymentsService,
        PaymentWebhooksService,
        { provide: PaymentProvider, useValue: router },
        { provide: PrismaService, useValue: db },
        { provide: RefundsService, useValue: {} },
        { provide: RentalCheckoutService, useValue: {} },
      ],
    }).compile()
    app = module.createNestApplication({ rawBody: true })
    app.use((req, _res, next) => {
      req.user = { id: userId }
      next()
    })
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    await app.init()
    inbox = module.get(PaymentWebhooksService)
  })
  afterEach(async () => {
    await app?.close()
    jest.restoreAllMocks()
    process.env = { ...original }
  })

  it('creates only a signed sandbox checkout with VND x100, GMT+7 and the booking return path', async () => {
    const result = await vnpay.createPayment(input)
    expect(result.kind).toBe('CONFIRMED_RESULT')
    if (result.kind !== 'CONFIRMED_RESULT') throw new Error('Missing checkout')
    expect(result.status).toBe('PROCESSING')
    const url = new URL(result.checkout.url!)
    const data = Object.fromEntries(url.searchParams)
    expect(url.origin + url.pathname).toBe('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html')
    expect(data.vnp_Amount).toBe('1000000')
    expect(data.vnp_IpAddr).toBe('127.0.0.1')
    expect(data.vnp_ReturnUrl).toBe(`http://localhost:5000/bookings/${bookingId}`)
    expect(data.vnp_SecureHash).toBe(sign(data))
    expect(data.vnp_CreateDate).toMatch(/^\d{14}$/)
    expect(data.vnp_ExpireDate).toBe(
      new Date(input.expiresAt.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace(/[-T:]/g, ''),
    )
    expect(rows.size).toBe(0)
  })
  it('persists the chosen gateway and rejects reusing a key for the other gateway', async () => {
    const key = randomUUID()
    const first = await checkout('vnpay', key).expect(201)
    const row = rows.get(first.body.paymentId)
    input.merchantRequestRef = row.merchantRequestRef
    expect(row).toMatchObject({
      paymentGateway: 'vnpay',
      providerEnvironment: 'SANDBOX',
      merchantAccountKey: 'TEST1234',
    })
    expect((await checkout('vnpay', key).expect(200)).body.paymentId).toBe(row.id)
    const changed = await checkout('momo', key).expect(409)
    expect(changed.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD')
    expect(changed.body.meta.contractVersion).toBeDefined()
    expect((await checkout('momo').expect(409)).body.error.code).toBe('PAYMENT_ATTEMPT_IN_PROGRESS')
    const response = await ipn().expect(200)
    expect(response.body.RspCode).toBe('00')
    expect([...events.values()][0]).toMatchObject({
      paymentGateway: 'vnpay',
      verifiedAt: expect.any(Date),
      processingStatus: 'RECEIVED',
    })
    expect(row.status).toBe('PROCESSING') // No booking or financial mutation in the adapter.
  })
  it('keeps default callers on mock, routes MoMo explicitly and exposes both options', async () => {
    expect(router.scope.gateway).toBe('mock')
    expect(
      (await request(app.getHttpServer()).get('/api/v1/payments/options').expect(200)).body.gateways.map(
        (x) => x.gateway,
      ),
    ).toEqual(['momo', 'vnpay'])
    const create = jest
      .spyOn(momo, 'createPayment')
      .mockResolvedValue({
        kind: 'CONFIRMED_RESULT',
        status: 'PROCESSING',
        checkout: { type: 'REDIRECT', url: 'https://test-payment.momo.vn/pay', qrData: null },
      })
    await checkout('momo').expect(201)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: 'momo',
        merchantAccountKey: 'MOMO_TEST',
        returnPath: `/bookings/${bookingId}`,
      }),
    )
    expect([...rows.values()][0].paymentGateway).toBe('momo')
    expect(() =>
      router.queryPayment({
        ...vnpay.scope,
        merchantAccountKey: 'wrong',
        merchantRequestRef: input.merchantRequestRef,
      }),
    ).toThrow('PAYMENT_PROVIDER_UNAVAILABLE')
  })
  it('uses the shared error envelope for bad gateways and unavailable providers', async () => {
    expect((await checkout('unknown').expect(400)).body.error.code).toBe('VALIDATION_ERROR')
    jest.spyOn(router, 'forGateway').mockReturnValue(undefined)
    expect((await checkout('vnpay').expect(503)).body.error.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE')
    expect(rows.size).toBe(0)
  })
  it('accepts repeated/reordered IPNs once and acknowledges an already confirmed payment', async () => {
    const first = await checkout('vnpay').expect(201)
    input.merchantRequestRef = rows.get(first.body.paymentId).merchantRequestRef
    const data = notification()
    expect((await ipn(data)).body.RspCode).toBe('00')
    expect((await ipn(Object.fromEntries(Object.entries(data).reverse()) as typeof data)).body.RspCode).toBe('00')
    expect(events.size).toBe(1)
    rows.get(first.body.paymentId).status = 'SUCCEEDED'
    expect((await ipn(data)).body.RspCode).toBe('02')
    expect(events.size).toBe(1)
  })
  it('deduplicates valid notifications without the optional PayDate', async () => {
    const first = await checkout('vnpay').expect(201)
    input.merchantRequestRef = rows.get(first.body.paymentId).merchantRequestRef
    const data: Record<string, string> = notification()
    delete data.vnp_PayDate
    data.vnp_SecureHash = sign(data)
    expect((await ipn(data as ReturnType<typeof notification>)).body.RspCode).toBe('00')
    expect((await ipn(data as ReturnType<typeof notification>)).body.RspCode).toBe('00')
    expect(events.size).toBe(1)
  })
  it('rejects tampering, wrong merchant, duplicate query keys, unknown references and wrong amounts', async () => {
    const first = await checkout('vnpay').expect(201)
    input.merchantRequestRef = rows.get(first.body.paymentId).merchantRequestRef
    expect((await ipn({ ...notification(), vnp_Amount: '9000000' })).body.RspCode).toBe('97')
    expect((await ipn(notification({ vnp_TmnCode: 'OTHER123' }))).body.RspCode).toBe('97')
    expect(
      (
        await request(app.getHttpServer()).get(
          `/api/v1/payments/webhooks/vnpay?${new URLSearchParams(notification())}&vnp_Amount=1000000`,
        )
      ).body.RspCode,
    ).toBe('97')
    expect((await ipn(notification({ vnp_TxnRef: randomUUID().replace(/-/g, '') }))).body.RspCode).toBe('01')
    expect((await ipn(notification({ vnp_Amount: '2000000' }))).body.RspCode).toBe('04')
    expect(events.size).toBe(0)
  })
  it('returns retry acknowledgement when durable intake fails', async () => {
    const first = await checkout('vnpay').expect(201)
    input.merchantRequestRef = rows.get(first.body.paymentId).merchantRequestRef
    db.paymentWebhookEvent.create.mockRejectedValue(new Error('storage offline'))
    expect((await ipn()).body.RspCode).toBe('99')
  })
  it.each([
    ['00', '00', 'SUCCEEDED'],
    ['24', '02', 'CANCELLED'],
    ['11', '02', 'EXPIRED'],
    ['51', '02', 'FAILED'],
    ['07', '00', 'PROCESSING'],
    ['00', '01', 'PROCESSING'],
    ['99', '02', 'PROCESSING'],
  ])('maps signed response %s/status %s conservatively to %s', async (code, status, expected) => {
    expect(
      await vnpay.verifyWebhook(
        Buffer.from(JSON.stringify(notification({ vnp_ResponseCode: code, vnp_TransactionStatus: status }))),
      ),
    ).toMatchObject({ status: expected, amount: '10000' })
  })
  it('keeps MoMo IPN available alongside VNPAY', async () => {
    const event = await vnpay.verifyWebhook(Buffer.from(JSON.stringify(notification())))
    jest.spyOn(momo, 'verifyWebhook').mockResolvedValue({ ...event!, ...momo.scope })
    await request(app.getHttpServer()).post('/api/v1/payments/webhooks/momo').send({ signature: 'stub' }).expect(204)
    expect([...events.values()][0].paymentGateway).toBe('momo')
  })
  it('does not time out an IPN-only payment before checkout expiry; routes recovery across enabled scopes', async () => {
    const first = await checkout('vnpay').expect(201)
    const row = { ...rows.get(first.body.paymentId), retryCount: 99, leaseToken: randomUUID() }
    const recovery = new PaymentRecoveryService(db, router, inbox, {} as RefundsService)
    const claim = jest.spyOn(recovery as any, 'claim').mockResolvedValue({ row, review: false, now: new Date() })
    await recovery.reconcilePayment(row.id)
    expect(db.$executeRaw.mock.calls[0][0].values).toContain('SCHEDULED')
    row.expiresAt = new Date(0)
    await recovery.reconcilePayment(row.id)
    expect(db.$executeRaw.mock.calls[1][0].values).toContain('NEEDS_REVIEW')
    claim.mockRestore()
    db.$queryRaw.mockResolvedValueOnce([])
    await recovery.reconcilePayment()
    expect(db.$queryRaw.mock.calls.at(-1)[0].values).toEqual(
      expect.arrayContaining(['mock', 'momo', 'vnpay', 'TEST1234']),
    )
  })
})
