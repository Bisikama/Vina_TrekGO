import { createHmac, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { MomoPaymentProvider } from '../src/modules/payments/momo-payment.provider'
import { PrismaService } from '../src/shared/services/prisma.service'
import { ProviderPaymentInput } from '../src/modules/payments/payment-provider.port'

describe('M9 MoMo wire contract (stubbed HTTPS; not a live sandbox run)', () => {
  const original = { ...process.env }
  const db = { payment: { findFirst: jest.fn() }, refund: { findFirst: jest.fn() } }
  let provider: MomoPaymentProvider, input: ProviderPaymentInput
  let http: jest.SpyInstance
  const sign = (raw: string) => createHmac('sha256', 'test-secret').update(raw).digest('hex')
  beforeEach(() => {
    Object.assign(process.env, {
      PAYMENT_PROVIDER: 'momo',
      PAYMENT_PROVIDER_ENVIRONMENT: 'SANDBOX',
      MOMO_SANDBOX_PARTNER_CODE: 'TEST',
      MOMO_SANDBOX_ACCESS_KEY: 'test-access',
      MOMO_SANDBOX_SECRET_KEY: 'test-secret',
      MOMO_SANDBOX_IPN_URL: 'https://merchant.test/api/v1/payments/webhooks/momo',
      MOMO_SANDBOX_REDIRECT_URL: 'https://merchant.test/return',
    })
    delete process.env.PAYMENT_PROVIDER_TIMEOUT_SECONDS
    delete process.env.PAYMENT_RECOVERY_LEASE_SECONDS
    provider = new MomoPaymentProvider(db as unknown as PrismaService)
    input = {
      ...provider.scope,
      merchantRequestRef: `payment:${randomUUID()}`,
      amount: '1050',
      currency: 'VND',
      paymentMethod: 'QR',
      expiresAt: new Date(Date.now() + 60000),
    }
    http = jest.spyOn(globalThis, 'fetch')
    db.payment.findFirst.mockReset()
    db.refund.findFirst.mockReset()
  })
  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...original }
  })
  const respond = (code: number, extra: object = {}) =>
    http.mockImplementation((_url, options) => {
      const body = JSON.parse(options.body)
      return Promise.resolve(new Response(
        JSON.stringify({
          partnerCode: body.partnerCode,
          orderId: body.orderId,
          requestId: body.requestId,
          amount: 1050,
          transId: 123456,
          responseTime: 1800000000000,
          resultCode: code,
          ...extra,
        }),
        { status: 200 },
      ))
    })
  const ipn = (extra: object = {}) => {
    const order = input.merchantRequestRef.replace(':', '-')
    const data = {
      partnerCode: 'TEST',
      orderId: order,
      requestId: order,
      amount: 1050,
      extraData: '',
      message: 'OK',
      orderInfo: 'TrekGo payment',
      orderType: 'momo_wallet',
      payType: 'qr',
      responseTime: 1800000000000,
      resultCode: 0,
      transId: 123456,
      ...extra,
    }
    const raw = `accessKey=test-access&amount=${data.amount}&extraData=${data.extraData}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&orderType=${data.orderType}&partnerCode=${data.partnerCode}&payType=${data.payType}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`
    return { ...data, signature: sign(raw) }
  }
  it('signs create exactly, reuses financial request identity and returns only a pending checkout', async () => {
    respond(0, { payUrl: 'https://test-payment.momo.vn/v2/gateway/pay?t=abc', qrCodeUrl: 'qr-data' })
    const result = await provider.createPayment(input)
    await provider.createPayment(input)
    expect(result).toEqual({
      kind: 'CONFIRMED_RESULT',
      status: 'PROCESSING',
      checkout: { type: 'QR', url: 'https://test-payment.momo.vn/v2/gateway/pay?t=abc', qrData: 'qr-data' },
    })
    const body = JSON.parse(http.mock.calls[0][1].body)
    expect(body.signature).toBe(
      sign(
        `accessKey=test-access&amount=1050&extraData=&ipnUrl=https://merchant.test/api/v1/payments/webhooks/momo&orderId=${body.orderId}&orderInfo=TrekGo payment&partnerCode=TEST&redirectUrl=https://merchant.test/return&requestId=${body.requestId}&requestType=captureWallet`,
      ),
    )
    expect(body.autoCapture).toBe(true)
    expect(http.mock.calls[1][1].body).toBe(http.mock.calls[0][1].body)
    expect(body.requestId.length).toBeLessThanOrEqual(50)
    expect(http.mock.calls[0][0]).toBe('https://test-payment.momo.vn/v2/gateway/api/create')
  })
  it('rejects amount/scope/expiry before transport and does not follow unsafe checkout URLs', async () => {
    for (const change of [
      { amount: '999' },
      { amount: '50000001' },
      { currency: 'USD' },
      { environment: 'PRODUCTION' as const },
      { expiresAt: new Date(0) },
    ])
      expect(await provider.createPayment({ ...input, ...change })).toEqual({ kind: 'UNKNOWN' })
    expect(http).not.toHaveBeenCalled()
    respond(0, { payUrl: 'https://attacker.test/pay' })
    expect(await provider.createPayment(input)).toEqual({ kind: 'UNKNOWN' })
  })
  it.each([1000, 7000, 7002, 9000])(
    'keeps non-final code %s processing and uses fresh query identities',
    async (code) => {
      respond(code)
      expect(await provider.queryPayment(input)).toMatchObject({
        kind: 'CONFIRMED_RESULT',
        event: { status: 'PROCESSING' },
      })
      await provider.queryPayment(input)
      const a = JSON.parse(http.mock.calls[0][1].body),
        b = JSON.parse(http.mock.calls[1][1].body)
      expect(a.requestId).not.toBe(b.requestId)
      expect(a.signature).toBe(
        sign(`accessKey=test-access&orderId=${a.orderId}&partnerCode=TEST&requestId=${a.requestId}`),
      )
    },
  )
  it('does not treat merchant errors, wrong identity or network errors as financial failure', async () => {
    for (const code of [13, 40, 41, 99, 12345]) {
      respond(code)
      expect(await provider.queryPayment(input)).toEqual({ kind: 'UNKNOWN' })
    }
    respond(0, { partnerCode: 'OTHER' })
    expect(await provider.queryPayment(input)).toEqual({ kind: 'UNKNOWN' })
    respond(0, { transId: Number.MAX_SAFE_INTEGER + 1 })
    expect(await provider.queryPayment(input)).toEqual({ kind: 'UNKNOWN' })
    http.mockRejectedValue(new Error('timeout'))
    expect(await provider.queryPayment(input)).toEqual({ kind: 'UNKNOWN' })
  })
  it('verifies authentic delayed IPN, rejects tampering and preserves fallback identity for conflict detection', async () => {
    const data = ipn()
    const verified = await provider.verifyWebhook(Buffer.from(JSON.stringify(data)))
    expect(verified).toMatchObject({
      kind: 'PAYMENT',
      status: 'SUCCEEDED',
      merchantRequestRef: input.merchantRequestRef,
      amount: '1050',
      transactionRef: '123456',
    })
    expect(await provider.verifyWebhook(Buffer.from(JSON.stringify({ ...data, amount: 2000 })))).toBeNull()
    expect(await provider.verifyWebhook(Buffer.from(JSON.stringify(ipn({ partnerCode: 'OTHER' }))))).toBeNull()
    expect(await provider.verifyWebhook(Buffer.from(JSON.stringify(ipn({ requestId: 'OTHER' }))))).toBeNull()
    expect(await provider.verifyWebhook(Buffer.from('null'))).toBeNull()
    const conflict = await provider.verifyWebhook(Buffer.from(JSON.stringify(ipn({ amount: 2000 }))))
    expect(conflict?.providerEventId).toBe(verified?.providerEventId)
  })
  it('allows NOT_FOUND retry only inside the conservative 30-day idempotency window', async () => {
    respond(42)
    db.payment.findFirst.mockResolvedValue({ createdAt: new Date() })
    expect(await provider.queryPayment(input)).toEqual({ kind: 'NOT_FOUND' })
    db.payment.findFirst.mockResolvedValue({ createdAt: new Date(0) })
    expect(await provider.queryPayment(input)).toEqual({ kind: 'UNKNOWN' })
  })
  it('signs full/partial refunds with original transaction, and queries only the requested refund', async () => {
    const ref = `refund:${randomUUID()}`,
      id = ref.replace(':', '-')
    const row = {
      merchantRefundRef: ref,
      amount: new Prisma.Decimal(1050),
      currency: 'VND',
      createdAt: new Date(),
      payment: {
        merchantRequestRef: input.merchantRequestRef,
        transactionRef: '123456',
        status: 'SUCCEEDED',
        paymentGateway: 'momo',
        providerEnvironment: 'SANDBOX',
        merchantAccountKey: 'TEST',
      },
    }
    db.refund.findFirst.mockResolvedValue(row)
    respond(0, { transId: 987654 })
    const command = { ...input, merchantRefundRef: ref }
    expect(await provider.refund(command)).toMatchObject({
      kind: 'CONFIRMED_RESULT',
      event: { kind: 'REFUND', transactionRef: '123456', refundTransactionRef: '987654' },
    })
    const body = JSON.parse(http.mock.calls[0][1].body)
    expect(body.signature).toBe(
      sign(
        `accessKey=test-access&amount=1050&description=&orderId=${id}&partnerCode=TEST&requestId=${id}&transId=123456`,
      ),
    )
    respond(0, {
      refundTrans: [{ orderId: 'other-refund', amount: 1000, resultCode: 0, transId: 999, createdTime: 1800000000000 }],
    })
    expect(await provider.queryRefund(command)).toEqual({ kind: 'UNKNOWN' })
    respond(0, {
      refundTrans: [{ orderId: id, amount: 1050, resultCode: 0, transId: 987654, createdTime: 1800000000000 }],
    })
    expect(await provider.queryRefund(command)).toMatchObject({
      event: { status: 'SUCCEEDED', merchantRefundRef: ref },
    })
    row.createdAt = new Date(0)
    http.mockClear()
    expect(await provider.refund(command)).toEqual({ kind: 'UNKNOWN' })
    expect(http).not.toHaveBeenCalled()
  })
  it('fails startup for production, missing credentials and an unsafe worker lease', () => {
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = 'PRODUCTION'
    expect(() => new MomoPaymentProvider(db as unknown as PrismaService)).toThrow('SANDBOX')
    process.env.PAYMENT_PROVIDER_ENVIRONMENT = 'SANDBOX'
    process.env.PAYMENT_RECOVERY_LEASE_SECONDS = '30'
    expect(() => new MomoPaymentProvider(db as unknown as PrismaService)).toThrow('lease')
    delete process.env.MOMO_SANDBOX_SECRET_KEY
    expect(() => new MomoPaymentProvider(db as unknown as PrismaService)).toThrow('MOMO_SANDBOX_SECRET_KEY')
  })
})
