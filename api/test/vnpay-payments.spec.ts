 
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
import { PaymentHistoryService } from '../src/modules/payments/payment-history.service'
import { PaymentsPort, SharedPaymentsPort } from '../src/modules/payments/payments.port'
import { PurchaseTrailUseCase } from '../src/modules/system-trail/application/use-cases/purchase-trail.use-case'
import { TrailPurchaseController } from '../src/modules/system-trail/presentation/controllers/trail-purchase.controller'
import { RentalPaymentsController } from '../src/modules/rental/payments/rental-payments.controller'
import { RentalExtensionPaymentsController } from '../src/modules/rental/payments/rental-extension-payments.controller'

describe('VNPAY merchant query/refund protocol (stubbed HTTPS)', () => {
  const original = { ...process.env }
  const secret = 'merchant-test-secret'
  let provider: VnpayPaymentProvider, db: any, payment: any, refund: any, http: jest.SpyInstance
  const hmac = (text: string) => createHmac('sha512', secret).update(text).digest('hex')
  const responseFields = [
    'vnp_ResponseId',
    'vnp_Command',
    'vnp_ResponseCode',
    'vnp_Message',
    'vnp_TmnCode',
    'vnp_TxnRef',
    'vnp_Amount',
    'vnp_BankCode',
    'vnp_PayDate',
    'vnp_TransactionNo',
    'vnp_TransactionType',
    'vnp_TransactionStatus',
    'vnp_OrderInfo',
  ]
  const signedResponse = (command: string, extra: Record<string, string> = {}) => {
    const data: Record<string, string> = {
      vnp_ResponseId: 'response01',
      vnp_Command: command,
      vnp_ResponseCode: '00',
      vnp_Message: 'Success',
      vnp_TmnCode: 'TEST1234',
      vnp_TxnRef: payment.id.replace(/-/g, ''),
      vnp_Amount: '1000000',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261016123000',
      vnp_TransactionNo: '123456',
      vnp_TransactionType: '01',
      vnp_TransactionStatus: '00',
      vnp_OrderInfo: 'Thanh toan TrekGo',
      ...extra,
    }
    const fields =
      command === 'querydr' ? [...responseFields, 'vnp_PromotionCode', 'vnp_PromotionAmount'] : responseFields
    data.vnp_SecureHash = hmac(fields.map((key) => data[key] ?? '').join('|'))
    return data
  }
  const reply = (data: Record<string, string>) =>
    http.mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }))
  const refundResponse = (extra: Record<string, string> = {}, command = 'refund') =>
    signedResponse(command, {
      vnp_Amount: refund.amount.mul(100).toFixed(0),
      vnp_TransactionType: refund.amount.equals(payment.amount) ? '02' : '03',
      vnp_TransactionNo: '987654',
      vnp_OrderInfo: `Refund TrekGo ${refund.id}`,
      ...extra,
    })
  const refundInput = () => ({
    ...provider.scope,
    merchantRequestRef: payment.merchantRequestRef,
    merchantRefundRef: refund.merchantRefundRef,
    amount: refund.amount.toFixed(0),
    currency: 'VND',
  })
  beforeEach(async () => {
    Object.assign(process.env, {
      PAYMENT_PROVIDER_ENVIRONMENT: 'SANDBOX',
      VNPAY_SANDBOX_TMN_CODE: 'TEST1234',
      VNPAY_SANDBOX_HASH_SECRET: secret,
      VNPAY_SANDBOX_RETURN_URL: 'https://merchant.test/return',
      VNPAY_SANDBOX_API_IP: '203.0.113.5',
    })
    const paymentId = randomUUID(),
      refundId = randomUUID()
    payment = {
      id: paymentId,
      merchantRequestRef: `payment:${paymentId}`,
      amount: new Prisma.Decimal(10000),
      currency: 'VND',
      paymentGateway: 'vnpay',
      providerEnvironment: 'SANDBOX',
      merchantAccountKey: 'TEST1234',
      status: 'SUCCEEDED',
      transactionRef: '123456',
      createdAt: new Date('2026-10-16T05:00:00Z'),
      reconcileStatus: 'RESOLVED',
    }
    refund = {
      id: refundId,
      paymentId,
      merchantRefundRef: `refund:${refundId}`,
      amount: new Prisma.Decimal(4000),
      currency: 'VND',
      requestHashVersion: 1,
      status: 'PENDING',
      reconcileStatus: 'SCHEDULED',
      createdAt: new Date('2026-10-16T06:00:00Z'),
      providerPayload: null,
      refundTransactionRef: null,
      payment,
    }
    db = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(payment),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
      },
      refund: {
        findFirst: jest.fn().mockResolvedValue(refund),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          if (where.providerPayload && refund.providerPayload !== null) return Promise.resolve({ count: 0 })
          Object.assign(refund, data)
          return Promise.resolve({ count: 1 })
        }),
      },
    }
    provider = new VnpayPaymentProvider(db)
    const result = await provider.createPayment({
      ...provider.scope,
      merchantRequestRef: payment.merchantRequestRef,
      amount: '10000',
      currency: 'VND',
      paymentMethod: 'REDIRECT',
      clientIp: '203.0.113.20',
      expiresAt: new Date(Date.now() + 600000),
    })
    if (result.kind !== 'CONFIRMED_RESULT') throw new Error('Missing checkout fixture')
    payment.checkoutData = result.checkout
    http = jest.spyOn(globalThis, 'fetch')
  })
  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...original }
  })

  it('queries a missing-IPN payment with the original checkout date and ordered HMAC', async () => {
    reply(signedResponse('querydr'))
    const result = await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef })
    expect(result).toMatchObject({
      kind: 'CONFIRMED_RESULT',
      event: {
        kind: 'PAYMENT',
        status: 'SUCCEEDED',
        amount: '10000',
        occurredAt: '2026-10-16T05:30:00.000Z',
        transactionRef: '123456',
      },
    })
    const [url, options] = http.mock.calls[0]
    expect(url).toBe('https://sandbox.vnpayment.vn/merchant_webapi/api/transaction')
    expect(options.redirect).toBe('error')
    const body = JSON.parse(options.body)
    expect(body.vnp_TransactionDate).toBe(new URL(payment.checkoutData.url).searchParams.get('vnp_CreateDate'))
    expect(body.vnp_IpAddr).toBe('203.0.113.5')
    expect(body.vnp_SecureHash).toBe(
      hmac(
        [
          body.vnp_RequestId,
          '2.1.0',
          'querydr',
          'TEST1234',
          body.vnp_TxnRef,
          body.vnp_TransactionDate,
          body.vnp_CreateDate,
          '203.0.113.5',
          body.vnp_OrderInfo,
        ].join('|'),
      ),
    )
    await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef })
    expect(JSON.parse(http.mock.calls[1][1].body).vnp_RequestId).not.toBe(body.vnp_RequestId)
  })
  it.each<Record<string, string>>([
    { vnp_TmnCode: 'OTHER123' },
    { vnp_TxnRef: 'other' },
    { vnp_Amount: '999900' },
    { vnp_TransactionType: '03' },
    { vnp_TransactionStatus: '07' },
    { vnp_PayDate: '' },
    { vnp_TransactionNo: '999' },
    { vnp_ResponseCode: '91' },
  ])('does not infer collection from mismatched or ambiguous query data: %j', async (extra) => {
    reply(signedResponse('querydr', extra))
    expect(await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef })).toEqual({
      kind: 'UNKNOWN',
    })
  })
  it('rejects tampered responses, unavailable transport and absent server IP without changing financial state', async () => {
    reply({ ...signedResponse('querydr'), vnp_Amount: '9000000' })
    expect(
      (await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef })).kind,
    ).toBe('UNKNOWN')
    http.mockRejectedValue(new Error('timeout'))
    expect(
      (await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef })).kind,
    ).toBe('UNKNOWN')
    http.mockClear()
    delete process.env.VNPAY_SANDBOX_API_IP
    expect(
      (await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef })).kind,
    ).toBe('UNKNOWN')
    expect(http).not.toHaveBeenCalled()
  })
  it.each(['4000', '10000'])(
    'dispatches a %s VND refund exactly once and recovers its signed response',
    async (amount) => {
      refund.amount = new Prisma.Decimal(amount)
      reply(refundResponse())
      expect(await provider.queryRefund(refundInput())).toEqual({ kind: 'NOT_FOUND' })
      const [first, concurrent] = await Promise.all([provider.refund(refundInput()), provider.refund(refundInput())])
      expect([first.kind, concurrent.kind].sort()).toEqual(['CONFIRMED_RESULT', 'UNKNOWN'])
      expect(http).toHaveBeenCalledTimes(1)
      const body = JSON.parse(http.mock.calls[0][1].body)
      expect(body.vnp_TransactionType).toBe(amount === '10000' ? '02' : '03')
      expect(body.vnp_RequestId).toBe(refund.id.replace(/-/g, ''))
      expect(body.vnp_Amount).toBe(String(Number(amount) * 100))
      expect(body.vnp_SecureHash).toBe(
        hmac(
          [
            body.vnp_RequestId,
            '2.1.0',
            'refund',
            'TEST1234',
            body.vnp_TransactionType,
            body.vnp_TxnRef,
            body.vnp_Amount,
            '123456',
            body.vnp_TransactionDate,
            'TrekGo',
            body.vnp_CreateDate,
            '203.0.113.5',
            `Refund TrekGo ${refund.id}`,
          ].join('|'),
        ),
      )
      const restarted = new VnpayPaymentProvider(db)
      expect(await restarted.queryRefund(refundInput())).toMatchObject({
        kind: 'CONFIRMED_RESULT',
        event: {
          kind: 'REFUND',
          status: 'SUCCEEDED',
          merchantRefundRef: refund.merchantRefundRef,
          amount,
          refundTransactionRef: '987654',
        },
      })
      expect(http).toHaveBeenCalledTimes(1)
    },
  )
  it('retains a dispatch after timeout and rejects an unrelated same-amount refund', async () => {
    http.mockRejectedValueOnce(new Error('timeout'))
    expect(await provider.refund(refundInput())).toEqual({ kind: 'UNKNOWN' })
    expect(refund.providerPayload.vnpayDispatch).toBeDefined()
    expect(await provider.refund(refundInput())).toEqual({ kind: 'UNKNOWN' })
    expect(http).toHaveBeenCalledTimes(1)
    reply(refundResponse({ vnp_OrderInfo: 'Refund TrekGo another-refund' }, 'querydr'))
    expect(await provider.queryRefund(refundInput())).toEqual({ kind: 'UNKNOWN' })
    reply(refundResponse({}, 'querydr'))
    expect(await provider.queryRefund(refundInput())).toMatchObject({
      kind: 'CONFIRMED_RESULT',
      event: { status: 'SUCCEEDED' },
    })
    expect(http.mock.calls.map((call) => JSON.parse(call[1].body).vnp_Command)).toEqual([
      'refund',
      'querydr',
      'querydr',
    ])
  })
  it('queries an accepted refund by its known transaction and waits for bank completion', async () => {
    reply(refundResponse({ vnp_TransactionStatus: '05', vnp_PayDate: '' }))
    expect(await provider.refund(refundInput())).toMatchObject({
      kind: 'CONFIRMED_RESULT',
      event: { status: 'PROCESSING' },
    })
    reply(refundResponse({ vnp_OrderInfo: 'Query result' }, 'querydr'))
    expect(await provider.queryRefund(refundInput())).toMatchObject({
      kind: 'CONFIRMED_RESULT',
      event: { status: 'SUCCEEDED' },
    })
    expect(JSON.parse(http.mock.calls[1][1].body).vnp_TransactionNo).toBe('987654')
    reply(refundResponse({ vnp_TransactionNo: '987655' }, 'querydr'))
    expect(await provider.queryRefund(refundInput())).toEqual({ kind: 'UNKNOWN' })
  })
  it('does not send an unverified source or an amount above collection', async () => {
    refund.amount = new Prisma.Decimal(10001)
    expect(await provider.refund(refundInput())).toEqual({ kind: 'UNKNOWN' })
    refund.amount = new Prisma.Decimal(1000)
    payment.status = 'PROCESSING'
    expect(await provider.refund(refundInput())).toEqual({ kind: 'UNKNOWN' })
    expect(http).not.toHaveBeenCalled()
    expect(refund.providerPayload).toBeNull()
  })
  it('keeps an ambiguous duplicate-request response unresolved and never sends again', async () => {
    reply(refundResponse({ vnp_ResponseCode: '94', vnp_TransactionStatus: '05' }))
    expect(await provider.refund(refundInput())).toEqual({ kind: 'UNKNOWN' })
    expect(await provider.refund(refundInput())).toEqual({ kind: 'UNKNOWN' })
    expect(http).toHaveBeenCalledTimes(1)
    expect(refund.status).toBe('PENDING')
  })
  it('reports a signed bank rejection as failed, not refunded', async () => {
    reply(refundResponse({ vnp_TransactionStatus: '09', vnp_PayDate: '' }))
    expect(await provider.refund(refundInput())).toMatchObject({
      kind: 'CONFIRMED_RESULT',
      event: { status: 'FAILED' },
    })
  })
  it('lets shared recovery dispatch refunds without enabling payment recreation', async () => {
    reply(refundResponse())
    const refunds = { applyEvent: jest.fn() }
    const recovery = new PaymentRecoveryService(
      db,
      provider,
      {} as PaymentWebhooksService,
      refunds as unknown as RefundsService,
    )
    refund.paymentGateway = 'vnpay'
    refund.providerEnvironment = 'SANDBOX'
    refund.merchantAccountKey = 'TEST1234'
    refund.leaseToken = randomUUID()
    refund.version = 2
    jest.spyOn(recovery as any, 'claim').mockResolvedValue({ row: refund, review: false, now: new Date() })
    await recovery.reconcileRefund(refund.id)
    expect(refunds.applyEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'REFUND', status: 'SUCCEEDED' }), {
      refundId: refund.id,
      lease: { token: refund.leaseToken, version: 2 },
    })
    expect(provider.supportsIdempotentCreate).toBe(false)
  })
})

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
    vnpay = new VnpayPaymentProvider(db)
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
      controllers: [
        VnpayIpnController,
        PaymentsController,
        PaymentOptionsController,
        PaymentWebhooksController,
        TrailPurchaseController,
        RentalPaymentsController,
        RentalExtensionPaymentsController,
      ],
      providers: [
        PaymentsService,
        PaymentWebhooksService,
        PurchaseTrailUseCase,
        { provide: PaymentsPort, useClass: SharedPaymentsPort },
        { provide: PaymentRecoveryService, useValue: {} },
        { provide: PaymentHistoryService, useValue: {} },
        { provide: PaymentProvider, useValue: router },
        { provide: PrismaService, useValue: db },
        { provide: RefundsService, useValue: {} },
        { provide: RentalCheckoutService, useValue: { reserve: jest.fn(), reserveExtension: jest.fn() } },
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

  it.each([
    [false, '203.0.113.10', '127.0.0.1'],
    [true, '203.0.113.10', '203.0.113.10'],
    [true, '2001:db8::10', '2001:db8::10'],
  ])(
    'passes trail request IP through checkout (trusted proxy: %s, forwarded IP: %s)',
    async (trustProxy, forwardedIp, expectedIp) => {
      // Only trust the local test proxy explicitly; arbitrary forwarded headers must not win.
      app
        .getHttpAdapter()
        .getInstance()
        .set('trust proxy', trustProxy ? 'loopback' : false)
      const createPayment = jest.spyOn(vnpay, 'createPayment')
      const trailId = randomUUID(),
        accessId = randomUUID(),
        invoiceId = randomUUID()
      const amount = new Prisma.Decimal(10000)
      const access = {
        id: accessId,
        systemTrailId: trailId,
        userId,
        status: 'PENDING_PAYMENT',
        sourceType: 'PURCHASE',
        priceSnapshot: amount,
        systemTrail: { status: 'ACTIVE', archivedAt: null },
      }
      const invoice = {
        id: invoiceId,
        trailAccessId: accessId,
        userId,
        invoiceType: 'TRAIL_ACCESS',
        status: 'PENDING_PAYMENT',
        revisionNo: 1,
        currency: 'VND',
        expiresAt: new Date(Date.now() + 900000),
        totalAmount: amount,
        subtotalAmount: amount,
        discountAmount: new Prisma.Decimal(0),
        invoiceLinesViaInvoiceId: [
          { lineCode: 'TRAIL_ACCESS', quantity: new Prisma.Decimal(1), unitAmount: amount, lineAmount: amount },
        ],
      }
      // Existing purchase reservation exercises both initial checkout and an idempotent HTTP retry.
      db.systemTrail = { findUnique: jest.fn().mockResolvedValue({ id: trailId }) }
      db.trailPurchaseRequest = {
        findUnique: jest.fn().mockResolvedValue({
          id: 'trail-vnpay-request',
          userId,
          systemTrailId: trailId,
          trailAccessId: accessId,
          invoiceId,
          paymentMethod: 'REDIRECT',
        }),
      }
      db.trailAccess = { findUniqueOrThrow: jest.fn().mockResolvedValue(access) }
      db.invoice.findUnique = jest.fn().mockResolvedValue(invoice)
      db.invoice.findUniqueOrThrow.mockResolvedValue(invoice)
      const purchase = (ip: string) =>
        request(app.getHttpServer())
          .post(`/api/v1/trails/${trailId}/purchase`)
          .set('Idempotency-Key', 'trail-vnpay')
          .set('X-Forwarded-For', ip)
          .send({ paymentMethod: 'REDIRECT', gateway: 'vnpay' })
      const first = await purchase(forwardedIp).expect(201)
      const url = new URL(first.body.checkout.url)
      expect(url.searchParams.get('vnp_IpAddr')).toBe(expectedIp)
      expect(url.searchParams.get('vnp_SecureHash')).toBe(sign(Object.fromEntries(url.searchParams)))
      expect(first.body.trailAccessId).toBe(accessId)
      const retry = await purchase('203.0.113.20').expect(200)
      expect(retry.body.paymentId).toBe(first.body.paymentId)
      expect(retry.body.checkout.url).toBe(first.body.checkout.url)
      expect(createPayment).toHaveBeenCalledTimes(1)
      expect(rows.size).toBe(1)
      const conflict = await request(app.getHttpServer())
        .post(`/api/v1/trails/${trailId}/purchase`)
        .set('Idempotency-Key', 'trail-vnpay')
        .send({ paymentMethod: 'REDIRECT', gateway: 'momo' })
        .expect(409)
      expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD')
    },
  )

  it.each(['rental-orders', 'rental-extensions'])(
    'routes %s checkout to VNPAY with the HTTP client IP and return context',
    async (route) => {
      const rental = app.get(RentalCheckoutService)
      const reserve = (route === 'rental-orders' ? rental.reserve : rental.reserveExtension) as jest.Mock
      const resourceId = randomUUID()
      const rentalOrderId = route === 'rental-orders' ? resourceId : randomUUID()
      reserve.mockImplementation(async (_input, scope) => ({
        created: true,
        payment: await db.payment.create({
          data: {
            id: randomUUID(),
            invoiceId: randomUUID(),
            amount: new Prisma.Decimal(10000),
            currency: 'VND',
            paymentGateway: scope.gateway,
            providerEnvironment: scope.environment,
            merchantAccountKey: scope.merchantAccountKey,
            merchantRequestRef: `payment:${randomUUID()}`,
            expiresAt: new Date(Date.now() + 600000),
            gatewayPayload: {
              requestSnapshot:
                route === 'rental-orders'
                  ? { operation: 'rental-checkout', rentalOrderId }
                  : { operation: 'rental-extension-checkout', orderId: rentalOrderId, extensionId: resourceId },
            },
          },
        }),
      }))
      const result = await request(app.getHttpServer())
        .post(`/api/v1/${route}/${resourceId}/payments`)
        .set('Idempotency-Key', randomUUID())
        .send({ paymentMethod: 'REDIRECT', gateway: 'vnpay' })
        .expect(201)
      const checkoutUrl = new URL(result.body.checkout.url)
      expect(checkoutUrl.searchParams.get('vnp_IpAddr')).toBe('127.0.0.1')
      const returnUrl = new URL(checkoutUrl.searchParams.get('vnp_ReturnUrl')!)
      expect(returnUrl.pathname).toBe('/payment-return')
      expect(returnUrl.searchParams.get('rentalOrderId')).toBe(rentalOrderId)
      expect(returnUrl.searchParams.get('extensionId')).toBe(route === 'rental-extensions' ? resourceId : null)
      expect(reserve).toHaveBeenCalledWith(
        expect.objectContaining({ gateway: 'vnpay', clientIp: expect.any(String) }),
        vnpay.scope,
      )

      if (route === 'rental-extensions') {
        const payment = rows.get(result.body.paymentId)
        payment.application = null
        db.rentalExtensionRequest = {
          findUnique: jest.fn().mockResolvedValue({
            id: resourceId,
            orderId: rentalOrderId,
            userId,
            status: 'PENDING_PAYMENT',
            invoiceId: payment.invoiceId,
            paymentRef: payment.id,
            additionalFee: payment.amount,
            currency: payment.currency,
            holdExpiresAt: payment.expiresAt,
          }),
        }
      db.invoice.findUnique = jest.fn().mockResolvedValue({
        id: payment.invoiceId,
        status: 'PENDING_PAYMENT',
        invoiceType: 'RENTAL',
        rentalOrderId,
        userId,
      })
        const status = await request(app.getHttpServer())
          .get(`/api/v1/rental-extensions/${resourceId}/payment`)
          .expect(200)
        expect(status.body).toMatchObject({
          extensionId: resourceId,
          rentalOrderId,
          extensionStatus: 'PENDING_PAYMENT',
          invoiceStatus: 'PENDING_PAYMENT',
          paymentStatus: 'PROCESSING',
          applicationStatus: null,
        })
      }
    },
  )

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
    const options = (await request(app.getHttpServer()).get('/api/v1/payments/options').expect(200)).body
    expect(options.defaultGateway).toBeNull()
    expect(options.gateways.map((x) => x.gateway)).toEqual(['momo', 'vnpay'])
    expect(options.gateways.every((x) => x.methods.join(',') === 'QR,REDIRECT')).toBe(true)
    const create = jest.spyOn(momo, 'createPayment').mockResolvedValue({
      kind: 'CONFIRMED_RESULT',
      status: 'PROCESSING',
      checkout: { type: 'REDIRECT', url: 'https://test-payment.momo.vn/pay', qrData: null },
    })
    await checkout('momo').expect(201)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway: 'momo',
        merchantAccountKey: 'MOMO_TEST',
        returnPath: `/payment-return?bookingId=${bookingId}`,
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
  it('keeps an unresolved VNPAY checkout recoverable until expiry; routes recovery across enabled scopes', async () => {
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
