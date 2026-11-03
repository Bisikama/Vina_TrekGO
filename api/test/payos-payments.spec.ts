import { randomUUID, createHmac } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { PayosPaymentProvider } from '../src/modules/payments/payos-payment.provider'
import { PayosMerchantClient, payosSignature } from '../src/modules/payments/payos-merchant.client'
import { PaymentProviderRouter } from '../src/modules/payments/payment-provider.router'
import { MockPaymentProvider } from '../src/modules/payments/mock-payment.provider'
import { VnpayPaymentProvider } from '../src/modules/payments/vnpay-payment.provider'
import { ManualRefundsService } from '../src/modules/payments/manual-refunds.service'
import {
  ManualRefundsController,
  AdminManualRefundsController,
} from '../src/modules/payments/manual-refunds.controller'
import { manualRefundReservation } from '../src/modules/payments/manual-refund-reservation'
import { PrismaService } from '../src/shared/services/prisma.service'
import { GlobalErrorFilter } from '../src/shared/errors'
import { ActiveUserData } from '../src/shared/types/user.type'
import { RolesGuard } from '../src/shared/guards/roles.guard'
import { REQUEST_USER_KEY } from '../src/shared/constants/auth.constant'
import { PaymentRecoveryService } from '../src/modules/payments/payment-recovery.service'
import { RefundsService } from '../src/modules/payments/refunds.service'
import { RentalRefundsService } from '../src/modules/payments/rental-refunds.service'
import { PaymentsController } from '../src/modules/payments/payments.controller'
import { PaymentsService } from '../src/modules/payments/payments.service'
import { PaymentsPort } from '../src/modules/payments/payments.port'
import { RentalPaymentsController } from '../src/modules/rental/payments/rental-payments.controller'
import { RentalExtensionPaymentsController } from '../src/modules/rental/payments/rental-extension-payments.controller'
import { TrailPurchaseController } from '../src/modules/system-trail/presentation/controllers/trail-purchase.controller'
import { PurchaseTrailUseCase } from '../src/modules/system-trail/application/use-cases/purchase-trail.use-case'

const secret = 'payos-checksum-test'
const configure = () =>
  Object.assign(process.env, {
    PAYOS_ENABLED: 'true',
    PAYOS_CLIENT_ID: 'client-test',
    PAYOS_API_KEY: 'api-key-test',
    PAYOS_CHECKSUM_KEY: secret,
    PAYOS_RETURN_URL: 'https://trekgo.test/payment-return',
    PAYOS_CANCEL_URL: 'https://trekgo.test/cancel',
    PAYOS_RECEIVING_BANK_BIN: '970422',
    PAYOS_RECEIVING_ACCOUNT_NUMBER: '0012345678',
    PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED: 'false',
  })

describe('payOS production adapter (stubbed transport)', () => {
  const original = { ...process.env }
  let db: any, provider: PayosPaymentProvider, payment: any, row: any, http: jest.SpyInstance
  beforeEach(() => {
    configure()
    payment = {
      id: randomUUID(),
      merchantRequestRef: `payment:${randomUUID()}`,
      amount: new Prisma.Decimal(10000),
      currency: 'VND',
      paymentGateway: 'payos',
      providerEnvironment: 'PRODUCTION',
      merchantAccountKey: 'client-test',
      paymentMethod: 'QR',
      expiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
      invoiceId: randomUUID(),
    }
    row = {
      paymentId: payment.id,
      orderCode: 123456n,
      paymentLinkId: 'link-test',
      requestSnapshot: { amount: 10000 },
      lastResponse: { checkoutUrl: 'https://pay.payos.vn/web/link-test', qrCode: 'qr-test' },
      payment,
    }
    db = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      payment: {
        findFirst: jest.fn().mockResolvedValue(payment),
        findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
        update: jest.fn(),
      },
      payosCheckout: {
        findUnique: jest.fn().mockResolvedValue(row),
        create: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(Object.assign(row, data))),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn() },
    }
    db.$transaction = (fn: any) => fn(db)
    provider = new PayosPaymentProvider(db)
    http = jest.spyOn(PayosMerchantClient.prototype, 'request')
  })
  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...original }
  })

  const webhook = (row: any, overrides: object = {}) => {
    const data = {
      code: '00',
      orderCode: Number(row.orderCode),
      amount: 10000,
      currency: 'VND',
      reference: 'FT-PAYOS-1',
      accountNumber: '0012345678',
      paymentLinkId: row.paymentLinkId,
      transactionDateTime: '2026-01-01 10:00:00',
      ...overrides,
    }
    return Buffer.from(JSON.stringify({ code: '00', success: true, data, signature: payosSignature(data, secret) }))
  }

  it('matches the published sorted-field HMAC convention independently', () => {
    const expected = createHmac('sha256', secret)
      .update('amount=10000&cancelUrl=https://x.test/c&description=TREKGO&orderCode=42&returnUrl=https://x.test/r')
      .digest('hex')
    expect(
      payosSignature(
        {
          returnUrl: 'https://x.test/r',
          description: 'TREKGO',
          amount: 10000,
          orderCode: 42,
          cancelUrl: 'https://x.test/c',
        },
        secret,
      ),
    ).toBe(expected)
  })

  it('keeps the default sandbox while payOS has its own production scope', () => {
    Object.assign(process.env, {
      PAYMENT_PROVIDER_ENVIRONMENT: 'SANDBOX',
      VNPAY_SANDBOX_TMN_CODE: 'TEST1234',
      VNPAY_SANDBOX_HASH_SECRET: 'test',
      VNPAY_SANDBOX_RETURN_URL: 'https://trekgo.test/return',
    })
    const router = new PaymentProviderRouter(
      [new MockPaymentProvider(db), new VnpayPaymentProvider(db), provider],
      'mock',
    )
    expect(router.scope.gateway).toBe('mock')
    expect(router.forGateway('vnpay')!.scope.environment).toBe('SANDBOX')
    expect(router.forGateway('payos')!.scope.environment).toBe('PRODUCTION')
  })

  it('rejects missing configuration and coexistence with simulated refunds', () => {
    delete process.env.PAYOS_API_KEY
    expect(() => new PayosPaymentProvider(db)).toThrow('PAYOS_API_KEY')
    configure()
    process.env.PAYMENT_SANDBOX_REFUND_SIMULATION_ENABLED = 'true'
    expect(() => new PayosPaymentProvider(db)).toThrow('simulation')
  })

  it('validates signed webhook identity, amount and bank account', async () => {
    const result = await provider.verifyWebhook(webhook(row))
    expect(result).toMatchObject({
      gateway: 'payos',
      environment: 'PRODUCTION',
      amount: '10000',
      status: 'SUCCEEDED',
      transactionRef: 'FT-PAYOS-1',
    })
    const tampered = JSON.parse(webhook(row).toString())
    tampered.data.amount = 1
    expect(await provider.verifyWebhook(Buffer.from(JSON.stringify(tampered)))).toBeNull()
    expect(await provider.verifyWebhook(webhook(row, { amount: 9999 }))).toBeNull()
    expect(db.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reconcileStatus: 'NEEDS_REVIEW' }) }),
    )
    expect(await provider.verifyWebhook(webhook(row, { accountNumber: 'OTHER' }))).toBeNull()
    db.payosCheckout.findUnique.mockResolvedValue(null)
    expect(await provider.verifyWebhook(webhook(row))).toBeNull()
  })

  it('deduplicates JSON key order and acknowledges only the exact signed connection probe', async () => {
    const first = JSON.parse(webhook(row).toString())
    const second = { ...first, data: Object.fromEntries(Object.entries(first.data).reverse()) }
    expect(await provider.verifyWebhook(Buffer.from(JSON.stringify(second)))).toEqual(
      await provider.verifyWebhook(Buffer.from(JSON.stringify(first))),
    )
    const probe = webhook(
      { orderCode: 123n, paymentLinkId: '124c33293c43417ab7879e14c8d9eb18' },
      { amount: 3000, accountNumber: '12345678', reference: 'TF230204212323' },
    )
    expect(await provider.isConnectionProbe(probe)).toBe(true)
    expect(await provider.isConnectionProbe(webhook(row))).toBe(false)
  })

  it('stores dispatch before transport and never blindly resends after timeout', async () => {
    row.paymentLinkId = null
    row.requestSnapshot = null
    row.lastResponse = null
    http.mockResolvedValue(null)
    db.payosCheckout.updateMany.mockImplementation(() => {
      if (row.lastResponse) return Promise.resolve({ count: 0 })
      row.lastResponse = { dispatchStarted: true }
      return Promise.resolve({ count: 1 })
    })
    const input = {
      ...provider.scope,
      merchantRequestRef: payment.merchantRequestRef,
      amount: '10000',
      currency: 'VND',
      paymentMethod: 'QR' as const,
      expiresAt: payment.expiresAt,
    }
    expect(await provider.createPayment(input)).toEqual({ kind: 'UNKNOWN' })
    expect(row.requestSnapshot).toMatchObject({
      amount: 10000,
      orderCode: 123456,
      description: 'TREKGO',
      expiredAt: Math.floor(payment.expiresAt.getTime() / 1000),
    })
    expect(await provider.createPayment(input)).toEqual({ kind: 'UNKNOWN' })
    expect(http.mock.calls.filter(([method]) => method === 'POST')).toHaveLength(1)
  })

  it('queries a paid link and flags partial, excess or multiple transfers for review', async () => {
    const data = {
      id: 'link-test',
      orderCode: Number(row.orderCode),
      amount: 10000,
      amountPaid: 10000,
      status: 'PAID',
      transactions: [{ amount: 10000, reference: 'FT-QUERY', transactionDateTime: '2026-01-01 10:00:00' }],
    }
    http.mockResolvedValue(data)
    expect(
      await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef }),
    ).toMatchObject({ kind: 'CONFIRMED_RESULT', event: { status: 'SUCCEEDED', transactionRef: 'FT-QUERY' } })
    for (const override of [
      { amountPaid: 5000 },
      { amountPaid: 15000 },
      { transactions: [data.transactions[0], data.transactions[0]] },
    ]) {
      http.mockResolvedValue({ ...data, ...override })
      expect(
        await provider.queryPayment({ ...provider.scope, merchantRequestRef: payment.merchantRequestRef }),
      ).toEqual({ kind: 'UNKNOWN' })
    }
    expect(db.auditLog.create).toHaveBeenCalledTimes(3)
  })

  it('creates the exact stored order as a real QR checkout', async () => {
    row.paymentLinkId = null
    row.requestSnapshot = null
    row.lastResponse = null
    http
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        paymentLinkId: 'link-created',
        orderCode: 123456,
        amount: 10000,
        bin: '970422',
        accountNumber: '0012345678',
        checkoutUrl: 'https://pay.payos.vn/web/link-created',
        qrCode: 'QR-PAYOS',
      })
    const result = await provider.createPayment({
      ...provider.scope,
      merchantRequestRef: payment.merchantRequestRef,
      amount: '10000',
      currency: 'VND',
      paymentMethod: 'QR',
      expiresAt: payment.expiresAt,
    })
    expect(result).toMatchObject({
      kind: 'CONFIRMED_RESULT',
      checkout: { type: 'QR', url: 'https://pay.payos.vn/web/link-created', qrData: 'QR-PAYOS' },
    })
    expect(http).toHaveBeenLastCalledWith('POST', '', row.requestSnapshot)
  })

  it('authenticates HTTPS responses and does not trust tampered response data', async () => {
    http.mockRestore()
    const data = { orderCode: 123456, amount: 10000 }
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ code: '00', data, signature: payosSignature(data, secret) }),
      } as Response)
    const client = new PayosMerchantClient('client-test', 'api-key-test', secret)
    expect(await client.request('GET', '/123456')).toEqual(data)
    expect(fetch).toHaveBeenCalledWith(
      'https://api-merchant.payos.vn/v2/payment-requests/123456',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-client-id': 'client-test', 'x-api-key': 'api-key-test' }),
        redirect: 'error',
      }),
    )
    fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({ code: '00', data: { ...data, amount: 1 }, signature: payosSignature(data, secret) }),
    } as Response)
    expect(await client.request('GET', '/123456')).toBeNull()
  })

  it('does not dispatch any automatic payOS refund', async () => {
    expect(await provider.refund()).toEqual({ kind: 'UNKNOWN' })
    expect(await provider.queryRefund()).toEqual({ kind: 'UNKNOWN' })
    expect(http).not.toHaveBeenCalled()
  })
})

describe('payOS checkout HTTP adapters', () => {
  let app: INestApplication
  const accepted = {
    httpStatus: 201,
    body: {
      gateway: 'payos',
      providerEnvironment: 'PRODUCTION',
      checkout: { type: 'QR', qrData: 'QR', url: 'https://pay.payos.vn/web/test' },
    },
  }
  const booking = jest.fn().mockResolvedValue(accepted),
    rental = jest.fn().mockResolvedValue(accepted)
  const extension = jest.fn().mockResolvedValue(accepted),
    trail = jest.fn().mockResolvedValue(accepted)
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        PaymentsController,
        RentalPaymentsController,
        RentalExtensionPaymentsController,
        TrailPurchaseController,
      ],
      providers: [
        { provide: PaymentsService, useValue: { createBookingCheckout: booking } },
        { provide: PaymentsPort, useValue: { createRentalCheckout: rental, createRentalExtensionCheckout: extension } },
        { provide: PurchaseTrailUseCase, useValue: { execute: trail } },
      ],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    app.use((req: any, _res: any, next: any) => {
      req[REQUEST_USER_KEY] = { id: 'owner-test' }
      next()
    })
    await app.init()
  })
  afterAll(async () => {
    await app.close()
  })
  it.each([
    ['bookings', 'payments', booking],
    ['rental-orders', 'payments', rental],
    ['rental-extensions', 'payments', extension],
    ['trails', 'purchase', trail],
  ])('accepts explicit payOS for %s without client-supplied money', async (prefix, suffix, call) => {
    await request(app.getHttpServer())
      .post(`/api/v1/${prefix}/${randomUUID()}/${suffix}`)
      .set('Idempotency-Key', randomUUID())
      .send({ gateway: 'payos', paymentMethod: 'QR' })
      .expect(201)
    expect(call).toHaveBeenLastCalledWith(
      expect.objectContaining({ gateway: 'payos', paymentMethod: 'QR', actorUserId: 'owner-test' }),
    )
    await request(app.getHttpServer())
      .post(`/api/v1/${prefix}/${randomUUID()}/${suffix}`)
      .set('Idempotency-Key', randomUUID())
      .send({ gateway: 'payos', paymentMethod: 'QR', amount: 1 })
      .expect(400)
  })
})

const databaseUrl = process.env.PAYMENT_TEST_DATABASE_URL
if (databaseUrl) {
  const u = new URL(databaseUrl)
  if (!['localhost', '127.0.0.1'].includes(u.hostname) || !/^\/payment_test_[a-z0-9_]+$/.test(u.pathname))
    throw new Error('Isolated localhost payment_test_* database required')
}
;(databaseUrl ? describe : describe.skip)('Manual payOS refunds — PostgreSQL concurrency and HTTP contract', () => {
  const db = new PrismaClient({ datasourceUrl: databaseUrl ?? 'postgresql://unused@localhost:1/payment_test_unused' })
  const service = new ManualRefundsService(db as PrismaService)
  let owner: ActiveUserData, admin: ActiveUserData, otherAdmin: ActiveUserData, stranger: ActiveUserData
  let app: INestApplication, refundId: string, paymentId: string, cancellationId: string
  const actor = async (role: 'USER' | 'ADMIN'): Promise<ActiveUserData> => {
    const u = await db.user.create({
      data: { authUserId: randomUUID(), email: `${randomUUID()}@payos.test`, fullName: 'NGUYEN VAN A', role },
    })
    return u
  }
  const recipient = {
    expectedVersion: 1,
    bankBin: '970422',
    accountNumber: '00112233',
    accountHolderName: 'NGUYEN VAN A',
    ownershipConfirmed: true as const,
  }
  const complete = (expectedVersion = 3, ref = randomUUID()) => ({
    expectedVersion,
    transferredAmount: '4000',
    sourceBankBin: '970422',
    sourceAccountNumber: '00998877',
    bankTransactionRef: ref,
    transferredAt: new Date().toISOString(),
  })

  beforeAll(async () => {
    await db.$connect()
    owner = await actor('USER')
    admin = await actor('ADMIN')
    otherAdmin = await actor('ADMIN')
    stranger = await actor('USER')
    const module = await Test.createTestingModule({
      controllers: [ManualRefundsController, AdminManualRefundsController],
      providers: [RolesGuard, { provide: ManualRefundsService, useValue: service }],
    }).compile()
    app = module.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    app.use((req: any, _res: any, next: any) => {
      req[REQUEST_USER_KEY] = req.headers['x-test-admin'] === 'yes' ? admin : owner
      next()
    })
    app.useGlobalGuards(module.get(RolesGuard, { strict: false }))
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
  })
  beforeEach(async () => {
    // Unique fixtures; never reset or delete existing data.
    const destination = await db.destination.create({ data: { name: 'payOS test' } })
    const pickup = await db.pickupPoint.create({
      data: { code: randomUUID(), name: 'Pickup', address: 'Test', latitude: 0, longitude: 0, createdBy: owner.id },
    })
    const trip = await db.trip.create({
      data: {
        tripType: 'PUBLIC',
        status: 'OPEN',
        title: 'payOS test',
        destinationId: destination.id,
        creatorId: owner.id,
        startAt: new Date('2035-01-01'),
        endAt: new Date('2035-01-02'),
        maxPax: 10,
      },
    })
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
        tripId: trip.id,
        userId: owner.id,
        pickupPointId: pickup.id,
        returnPointId: pickup.id,
        bookingPolicyId: policy.id,
        participantCount: 1,
        pricePerPaxSnapshot: 10000,
        subtotalAmount: 10000,
        insuranceAmount: 0,
        discountAmount: 0,
        totalAmount: 10000,
        policySnapshot: {},
        expiresAt: new Date(Date.now() + 900000),
      },
    })
    const invoice = await db.invoice.create({
      data: {
        invoiceNo: randomUUID(),
        invoiceType: 'BOOKING',
        userId: owner.id,
        bookingId: booking.id,
        revisionNo: 1,
        subtotalAmount: 10000,
        discountAmount: 0,
        totalAmount: 10000,
        status: 'PAID',
      },
    })
    const payment = await db.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 10000,
        paymentGateway: 'payos',
        providerEnvironment: 'PRODUCTION',
        merchantAccountKey: 'client-test',
        merchantRequestRef: `payment:${randomUUID()}`,
        idempotencyKey: randomUUID(),
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        requestHash: 'a'.repeat(64),
        requestHashVersion: 1,
        application: { create: { status: 'APPLIED', appliedAt: new Date(), decidedAt: new Date() } },
      },
    })
    paymentId = payment.id
    const cancellation = await db.bookingCancellation.create({
      data: {
        bookingId: booking.id,
        source: 'USER',
        cancelledBy: owner.id,
        policySnapshot: {},
        refundableAmount: 10000,
        idempotencyKey: randomUUID(),
      },
    })
    cancellationId = cancellation.id
    const refund = await db.refund.create({
      data: {
        paymentId,
        purpose: 'BOOKING_CANCELLATION',
        amount: 4000,
        currency: 'VND',
        idempotencyKey: randomUUID(),
        paymentGateway: 'payos',
        providerEnvironment: 'PRODUCTION',
        merchantAccountKey: 'client-test',
        merchantRefundRef: `refund:${randomUUID()}`,
        requestHash: 'a'.repeat(64),
        requestHashVersion: 1,
        businessActionId: randomUUID(),
        bookingCancellationId: cancellationId,
        ...manualRefundReservation('payos'),
      },
    })
    refundId = refund.id
  })

  it('enforces owner access, locks recipients and serializes two simultaneous claims', async () => {
    await expect(service.mutate(refundId, stranger, 'foreign', 'recipient', recipient)).rejects.toMatchObject({
      code: 'PAYMENT_NOT_FOUND',
    })
    await service.mutate(refundId, owner, randomUUID(), 'recipient', recipient)
    const claims = await Promise.allSettled(
      [admin, otherAdmin].map((a) =>
        service.mutate(refundId, a, randomUUID(), 'claim', { expectedVersion: 2, accountNameChecked: true }),
      ),
    )
    expect(claims.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    await expect(
      service.mutate(refundId, owner, randomUUID(), 'recipient', { ...recipient, expectedVersion: 3 }),
    ).rejects.toMatchObject({ code: 'MANUAL_REFUND_RECIPIENT_LOCKED' })
  })

  it('atomically completes once, preserves invoice totals and replays the exact idempotent result', async () => {
    await service.mutate(refundId, owner, randomUUID(), 'recipient', recipient)
    await service.mutate(refundId, admin, randomUUID(), 'claim', { expectedVersion: 2, accountNameChecked: true })
    const body = complete(),
      key = randomUUID()
    await expect(service.mutate(refundId, otherAdmin, randomUUID(), 'complete', body)).rejects.toMatchObject({
      code: 'MANUAL_REFUND_NOT_ASSIGNED',
    })
    await expect(
      service.mutate(refundId, admin, randomUUID(), 'complete', { ...body, transferredAmount: '5000' }),
    ).rejects.toMatchObject({ code: 'MANUAL_REFUND_AMOUNT_MISMATCH' })
    const results = await Promise.all([
      service.mutate(refundId, admin, key, 'complete', body),
      service.mutate(refundId, admin, key, 'complete', body),
    ])
    expect(results[0]).toEqual(results[1])
    expect(results[0]).toMatchObject({ status: 'SUCCEEDED', confirmationSource: 'ADMIN_MANUAL' })
    expect(await db.paymentOutboxEvent.count({ where: { aggregateId: refundId, eventType: 'REFUND_SUCCEEDED' } })).toBe(
      1,
    )
    expect(await db.auditLog.count({ where: { entityId: refundId, action: 'MANUAL_REFUND_COMPLETE' } })).toBe(1)
    const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: true } })
    expect(p.invoice.status).toBe('PARTIALLY_REFUNDED')
    await expect(
      service.mutate(refundId, admin, key, 'complete', { ...body, bankTransactionRef: 'CHANGED' }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' })
  })

  it('keeps uncertain transfers reserved and permits investigation reassignment without resetting the claim time', async () => {
    await service.mutate(refundId, owner, randomUUID(), 'recipient', recipient)
    await service.mutate(refundId, admin, randomUUID(), 'claim', { expectedVersion: 2, accountNameChecked: true })
    const original = await db.manualRefund.findUniqueOrThrow({ where: { refundId } })
    await service.mutate(refundId, admin, randomUUID(), 'review', { expectedVersion: 3, reason: 'Bank timeout' })
    await expect(
      service.mutate(refundId, admin, randomUUID(), 'release', {
        expectedVersion: 4,
        noTransferConfirmed: true,
        reason: 'Uncertain',
      }),
    ).rejects.toMatchObject({ code: 'MANUAL_REFUND_INVALID_STATE' })
    await service.mutate(refundId, admin, randomUUID(), 'reassign', {
      expectedVersion: 4,
      assignedAdminId: otherAdmin.id,
      reason: 'Investigate bank history',
    })
    const updated = await db.manualRefund.findUniqueOrThrow({ where: { refundId } })
    expect(updated.claimedAt).toEqual(original.claimedAt)
    expect(updated.status).toBe('NEEDS_REVIEW')
    await service.mutate(refundId, otherAdmin, randomUUID(), 'complete', complete(5))
    expect((await db.refund.findUniqueOrThrow({ where: { id: refundId } })).status).toBe('SUCCEEDED')
  })

  it('rejects reusing a bank transfer across different refunds with a database unique constraint', async () => {
    await service.mutate(refundId, owner, randomUUID(), 'recipient', recipient)
    await service.mutate(refundId, admin, randomUUID(), 'claim', { expectedVersion: 2, accountNameChecked: true })
    const ref = randomUUID()
    await service.mutate(refundId, admin, randomUUID(), 'complete', complete(3, ref))
    const second = await db.refund.create({
      data: {
        paymentId,
        purpose: 'BOOKING_CANCELLATION',
        amount: 4000,
        currency: 'VND',
        idempotencyKey: randomUUID(),
        paymentGateway: 'payos',
        providerEnvironment: 'PRODUCTION',
        merchantAccountKey: 'client-test',
        merchantRefundRef: `refund:${randomUUID()}`,
        requestHash: 'a'.repeat(64),
        requestHashVersion: 1,
        businessActionId: randomUUID(),
        bookingCancellationId: cancellationId,
        ...manualRefundReservation('payos'),
      },
    })
    await service.mutate(second.id, owner, randomUUID(), 'recipient', recipient)
    await service.mutate(second.id, admin, randomUUID(), 'claim', { expectedVersion: 2, accountNameChecked: true })
    await expect(service.mutate(second.id, admin, randomUUID(), 'complete', complete(3, ref))).rejects.toMatchObject({
      code: 'MANUAL_REFUND_TRANSFER_REUSED',
    })
    expect((await db.refund.findUniqueOrThrow({ where: { id: second.id } })).status).toBe('PROCESSING')
    expect(await db.paymentOutboxEvent.count({ where: { aggregateId: second.id } })).toBe(0)
  })

  it('excludes manual refunds from recovery and rejects provider reconciliation scheduling', async () => {
    const router = new PaymentProviderRouter([new MockPaymentProvider(db as PrismaService)], 'mock')
    const recovery = new PaymentRecoveryService(db as PrismaService, router, {} as any, {} as any)
    expect(await recovery.reconcileRefund(refundId)).toBe(false)
    await expect(recovery.schedule('refund', refundId, admin.id, 'Not a provider refund')).rejects.toMatchObject({
      code: 'MANUAL_REFUND_INVALID_STATE',
    })
    expect((await db.refund.findUniqueOrThrow({ where: { id: refundId } })).retryCount).toBe(0)
    const row = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } })
    const refunds = new RefundsService(db as PrismaService, new RentalRefundsService(db as PrismaService))
    expect(
      await refunds.applyEvent({
        gateway: 'payos',
        environment: 'PRODUCTION',
        merchantAccountKey: 'client-test',
        kind: 'REFUND',
        merchantRefundRef: row.merchantRefundRef!,
        merchantRequestRef: row.payment.merchantRequestRef!,
        transactionRef: null,
        refundTransactionRef: 'FORGED-PROVIDER-REFUND',
        providerEventId: randomUUID(),
        amount: '4000',
        currency: 'VND',
        status: 'SUCCEEDED',
        occurredAt: new Date().toISOString(),
      }),
    ).toBe(false)
    expect((await db.refund.findUniqueOrThrow({ where: { id: refundId } })).status).toBe('PENDING')
  })

  it('creates manual work atomically from the real booking cancellation reservation service', async () => {
    const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: true } })
    await db.booking.update({ where: { id: p.invoice.bookingId! }, data: { status: 'CANCELLED' } })
    const refunds = new RefundsService(db as PrismaService, new RentalRefundsService(db as PrismaService))
    const result = await refunds.requestRefund({
      paymentId,
      businessActionId: `booking-cancellation:${cancellationId}`,
      purpose: 'BOOKING_CANCELLATION',
      amount: '6000',
      idempotencyKey: randomUUID(),
      source: { bookingCancellationId: cancellationId },
    })
    expect(result.executionMode).toBe('MANUAL_BANK_TRANSFER')
    const reserved = await db.refund.findUniqueOrThrow({
      where: { id: result.refundId },
      include: { manualRefund: true },
    })
    expect(reserved).toMatchObject({
      reconcileStatus: 'IDLE',
      nextRetryAt: null,
      manualRefund: { status: 'AWAITING_RECIPIENT' },
    })
  })

  it('creates a manual technical reversal for an actual duplicate collection', async () => {
    const first = await db.payment.findUniqueOrThrow({ where: { id: paymentId } })
    const second = await db.payment.create({
      data: {
        invoiceId: first.invoiceId,
        amount: 10000,
        paymentGateway: 'payos',
        providerEnvironment: 'PRODUCTION',
        merchantAccountKey: 'client-test',
        merchantRequestRef: `payment:${randomUUID()}`,
        idempotencyKey: randomUUID(),
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        requestHash: 'b'.repeat(64),
        requestHashVersion: 1,
        application: { create: { status: 'REJECTED', reasonCode: 'DUPLICATE_PAYMENT', decidedAt: new Date() } },
      },
    })
    await db.paymentOutboxEvent.create({
      data: {
        deduplicationKey: `payment:${second.id}:technical-reversal-requested:v1`,
        eventType: 'TECHNICAL_REVERSAL_REQUESTED',
        aggregateType: 'Payment',
        aggregateId: second.id,
        payload: {
          schemaVersion: 1,
          paymentId: second.id,
          invoiceId: first.invoiceId,
          reasonCode: 'DUPLICATE_PAYMENT',
        },
      },
    })
    const refunds = new RefundsService(db as PrismaService, new RentalRefundsService(db as PrismaService))
    const result = await refunds.requestRefund({
      paymentId: second.id,
      businessActionId: `payment:${second.id}:technical-reversal:v1`,
      purpose: 'TECHNICAL_REVERSAL',
      reasonCode: 'DUPLICATE_PAYMENT',
      amount: '10000',
      idempotencyKey: randomUUID(),
      source: {},
    })
    const reserved = await db.refund.findUniqueOrThrow({
      where: { id: result.refundId },
      include: { manualRefund: true },
    })
    expect(reserved).toMatchObject({
      executionMode: 'MANUAL_BANK_TRANSFER',
      reconcileStatus: 'IDLE',
      manualRefund: { status: 'AWAITING_RECIPIENT' },
    })
    await service.mutate(result.refundId, owner, randomUUID(), 'recipient', recipient)
    await service.mutate(result.refundId, admin, randomUUID(), 'claim', {
      expectedVersion: 2,
      accountNameChecked: true,
    })
    await service.mutate(result.refundId, admin, randomUUID(), 'complete', {
      ...complete(),
      transferredAmount: '10000',
    })
    expect((await db.invoice.findUniqueOrThrow({ where: { id: first.invoiceId } })).status).toBe('PAID')
  })

  it('returns the shared error envelope, protects admin routes and documents every manual mutation', async () => {
    const missingKey = await request(app.getHttpServer())
      .put(`/api/v1/refunds/${refundId}/recipient`)
      .send(recipient)
      .expect(400)
    expect(missingKey.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', retryable: false },
      meta: { contractVersion: '0.2.0-final-flow' },
    })
    await request(app.getHttpServer()).get('/api/v1/admin/manual-refunds').expect(403)
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/manual-refunds/${refundId}`)
      .set('x-test-admin', 'yes')
      .expect(200)
    expect(detail.body.executionMode).toBe('MANUAL_BANK_TRANSFER')
    await request(app.getHttpServer())
      .put(`/api/v1/refunds/${refundId}/recipient`)
      .set('Idempotency-Key', randomUUID())
      .send(recipient)
      .expect(200)
    const list = await request(app.getHttpServer()).get('/api/v1/refunds').expect(200)
    expect(list.body.items.find((r: any) => r.refundId === refundId).manualRefund.recipient.accountNumber).toBe(
      '****2233',
    )
    await request(app.getHttpServer())
      .post(`/api/v1/admin/manual-refunds/${refundId}/claim`)
      .set('x-test-admin', 'yes')
      .set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: 2, accountNameChecked: true })
      .expect(200)
    const done = await request(app.getHttpServer())
      .post(`/api/v1/admin/manual-refunds/${refundId}/complete`)
      .set('x-test-admin', 'yes')
      .set('Idempotency-Key', randomUUID())
      .send(complete())
      .expect(200)
    expect(done.body).toMatchObject({
      status: 'SUCCEEDED',
      confirmationSource: 'ADMIN_MANUAL',
      manualRefund: { manualStatus: 'COMPLETED' },
    })
    const docs = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('payOS test').setVersion('1').build())
    for (const action of ['claim', 'release', 'review', 'reassign', 'complete'])
      expect(docs.paths[`/api/v1/admin/manual-refunds/{id}/${action}`]?.post?.requestBody).toBeDefined()
  })
})
