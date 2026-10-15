import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createHmac } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { MockPaymentCheckoutController } from '../src/modules/payments/mock-payment-checkout.controller'
import { PaymentProvider } from '../src/modules/payments/payment-provider.port'
import { PaymentWebhooksService } from '../src/modules/payments/payment-webhooks.service'
import { PrismaService } from '../src/shared/services/prisma.service'
import { GlobalErrorFilter } from '../src/shared/errors'

describe('Frontend mock checkout HTTP boundary', () => {
  const original = { ...process.env }
  const id = '11111111-1111-4111-8111-111111111111'
  const scope = { gateway: 'mock', environment: 'MOCK', merchantAccountKey: 'trekgo-mock-v1' }
  const db = { payment: { findFirst: jest.fn() } }
  const webhooks = { receive: jest.fn() }
  let app: INestApplication
  let row: any
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [MockPaymentCheckoutController], providers: [
      { provide: PrismaService, useValue: db }, { provide: PaymentProvider, useValue: { scope } },
      { provide: PaymentWebhooksService, useValue: webhooks },
    ] }).compile()
    app = module.createNestApplication()
    app.useGlobalFilters(new GlobalErrorFilter())
    // Auth identity fixture; actual bearer verification belongs to the shared auth guard.
    app.use((req: any, _res: any, next: () => void) => {
      if (req.headers.authorization) req.user = { id: 'owner' }
      next()
    })
    await app.init()
  })
  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    process.env.PAYMENT_MOCK_ENABLED = 'true'
    process.env.PAYMENT_MOCK_WEBHOOK_SECRET = 'local-test-secret-with-at-least-32-bytes'
    scope.gateway = 'mock'
    jest.clearAllMocks()
    row = { id, paymentGateway: 'mock', providerEnvironment: 'MOCK', merchantAccountKey: scope.merchantAccountKey,
      merchantRequestRef: `payment:${id}`, status: 'PROCESSING', amount: new Prisma.Decimal(2500000),
      currency: 'VND', expiresAt: new Date(Date.now() + 60000), application: null }
    db.payment.findFirst.mockResolvedValue(row)
    webhooks.receive.mockResolvedValue(undefined)
  })
  afterAll(async () => { process.env = original; await app.close() })
  const post = (paymentId = id) => request(app.getHttpServer()).post(`/payments/${paymentId}/mock-confirm`).set('Authorization', 'Bearer fixture')
  it('uses server money and signs normal webhook intake, without claiming domain confirmation', async () => {
    const response = await post().send({ amount: '1', status: 'FAILED' }).expect(202)
    expect(response.body).toMatchObject({ accepted: true, paymentStatus: 'PROCESSING', applicationStatus: null })
    expect(db.payment.findFirst.mock.calls[0][0].where.invoice).toEqual({ userId: 'owner', invoiceType: { in: ['BOOKING', 'RENTAL'] } })
    const [body, headers] = webhooks.receive.mock.calls[0]
    expect(JSON.parse(body.toString())).toMatchObject({ amount: '2500000', status: 'SUCCEEDED', transactionRef: `mock:payment:${id}` })
    expect(headers['x-mock-signature']).toBe(createHmac('sha256', process.env.PAYMENT_MOCK_WEBHOOK_SECRET!).update(headers['x-mock-timestamp']).update('.').update(body).digest('hex'))
  })
  it('requires an identity and hides missing or unowned resources', async () => {
    await request(app.getHttpServer()).post(`/payments/${id}/mock-confirm`).expect(401)
    db.payment.findFirst.mockResolvedValue(null)
    expect((await post().expect(404)).body.error.code).toBe('PAYMENT_NOT_FOUND')
    expect(webhooks.receive).not.toHaveBeenCalled()
  })
  it('blocks production even with mock enabled, and blocks a real provider', async () => {
    process.env.NODE_ENV = 'production'
    await post().expect(503)
    process.env.NODE_ENV = 'test'
    scope.gateway = 'momo'
    await post().expect(503)
    expect(db.payment.findFirst).not.toHaveBeenCalled()
  })
  it('rejects expired, cancelled and real payments', async () => {
    row.expiresAt = new Date(0)
    await post().expect(409)
    row.expiresAt = new Date(Date.now() + 60000)
    row.status = 'CANCELLED'
    await post().expect(409)
    row.status = 'PROCESSING'
    row.paymentGateway = 'momo'
    await post().expect(409)
    expect(webhooks.receive).not.toHaveBeenCalled()
  })
  it('replays succeeded payments without resubmitting or hiding application rejection', async () => {
    row.status = 'SUCCEEDED'
    row.application = { status: 'REJECTED' }
    expect((await post().expect(202)).body.applicationStatus).toBe('REJECTED')
    expect(webhooks.receive).not.toHaveBeenCalled()
  })
  it('uses the shared validation error contract for invalid ids', async () => {
    expect((await post('invalid').expect(400)).body.error.code).toBe('VALIDATION_ERROR')
    expect(db.payment.findFirst).not.toHaveBeenCalled()
  })
})
