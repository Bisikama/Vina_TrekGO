jest.mock('@nestjs/schedule', () => ({
  Interval: () => () => undefined,
}))

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/services/prisma.service'
import { GlobalErrorFilter } from '../../shared/errors'
import { PaymentHistoryService } from './payment-history.service'
import { RentalPaymentsController } from '../rental/payments/rental-payments.controller'
import { UserTransactionsController } from './user-transactions.controller'
import { PaymentsPort, SharedPaymentsPort } from './payments.port'
import { PaymentsService } from './payments.service'
import { RefundsService } from './refunds.service'
import { PaymentRecoveryService } from './payment-recovery.service'
import { REQUEST_USER_KEY } from '../../shared/constants/auth.constant'

describe('Payment History & User Transactions APIs', () => {
  let app: INestApplication
  let historyService: PaymentHistoryService
  let prismaMock: {
    rentalOrder: { findUnique: jest.Mock }
    rentalExtensionRequest: { findMany: jest.Mock }
    invoice: { findMany: jest.Mock }
    payment: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock }
    refund: { findMany: jest.Mock; count: jest.Mock }
    $queryRaw: jest.Mock
  }
  let paymentsMock: {
    createRentalCheckout: jest.Mock
  }

  const userA = '11111111-1111-4111-a111-111111111111'
  const userB = '22222222-2222-4222-a222-222222222222'
  const orderId = '33333333-3333-4333-a333-333333333333'
  let currentUser = userA

  beforeEach(async () => {
    currentUser = userA
    prismaMock = {
      rentalOrder: { findUnique: jest.fn() },
      rentalExtensionRequest: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn() },
      payment: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
      refund: { findMany: jest.fn(), count: jest.fn() },
      $queryRaw: jest.fn(),
    }
    paymentsMock = {
      createRentalCheckout: jest.fn(),
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RentalPaymentsController, UserTransactionsController],
      providers: [
        PaymentHistoryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RefundsService, useValue: {} },
        { provide: PaymentRecoveryService, useValue: {} },
        { provide: PaymentsService, useValue: paymentsMock },
        { provide: PaymentsPort, useClass: SharedPaymentsPort },
      ],
    }).compile()

    historyService = moduleRef.get(PaymentHistoryService)
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())

    // Mock authentication middleware to attach currentUser
    app.use((req: any, _res: any, next: any) => {
      if (req.headers.authorization) {
        req[REQUEST_USER_KEY] = { id: currentUser, role: 'USER' }
      }
      next()
    })

    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  // =========================================================================
  // Test 1: Single order with 3 payment attempts: FAILED, CANCELLED, SUCCEEDED
  // =========================================================================
  it('1. Đơn có 3 payment attempts: FAILED, CANCELLED, SUCCEEDED -> trả đủ 3 bản ghi, không giới hạn take: 1', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', invoiceNo: 'INV-RO-1', revisionNo: 1 },
    ])
    prismaMock.payment.count.mockResolvedValue(3)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-3',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1500000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        paidAt: new Date('2026-10-18T10:05:00Z'),
        application: { status: 'APPLIED', reasonCode: null },
        refundsViaPaymentId: [],
        invoice: { id: 'inv-1', invoiceNo: 'INV-RO-1', revisionNo: 1 },
      },
      {
        id: 'pay-2',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1500000),
        currency: 'VND',
        status: 'CANCELLED',
        paymentMethod: 'REDIRECT',
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-18T09:30:00Z'),
        paidAt: null,
        application: null,
        refundsViaPaymentId: [],
        invoice: { id: 'inv-1', invoiceNo: 'INV-RO-1', revisionNo: 1 },
      },
      {
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1500000),
        currency: 'VND',
        status: 'FAILED',
        paymentMethod: 'QR',
        paymentGateway: 'momo',
        createdAt: new Date('2026-10-18T09:00:00Z'),
        paidAt: null,
        application: null,
        refundsViaPaymentId: [],
        invoice: { id: 'inv-1', invoiceNo: 'INV-RO-1', revisionNo: 1 },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.orderId).toBe(orderId)
    expect(res.body.items).toHaveLength(3)
    expect(res.body.items.map((i: any) => i.status)).toEqual(['SUCCEEDED', 'CANCELLED', 'FAILED'])
    expect(res.body.pagination).toEqual({ page: 1, pageSize: 20, total: 3, totalPages: 1 })
  })

  // =========================================================================
  // Test 2: RentalOrder có nhiều Invoice / revisions -> không bỏ sót lịch sử
  // =========================================================================
  it('2. RentalOrder có nhiều Invoice và Invoice revisions -> truy xuất đầy đủ các lần thanh toán', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: 'inv-1', invoiceNo: 'INV-RO-1', revisionNo: 1 },
      { id: 'inv-ext-1', invoiceNo: 'RENTAL-EXT-1', revisionNo: 2 },
    ])
    prismaMock.payment.count.mockResolvedValue(2)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-ext',
        invoiceId: 'inv-ext-1',
        amount: new Prisma.Decimal(200000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-19T10:00:00Z'),
        paidAt: new Date('2026-10-19T10:02:00Z'),
        application: { status: 'APPLIED', reasonCode: null },
        refundsViaPaymentId: [],
        invoice: { id: 'inv-ext-1', invoiceNo: 'RENTAL-EXT-1', revisionNo: 2 },
      },
      {
        id: 'pay-orig',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1500000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        paidAt: new Date('2026-10-18T10:05:00Z'),
        application: { status: 'APPLIED', reasonCode: null },
        refundsViaPaymentId: [],
        invoice: { id: 'inv-1', invoiceNo: 'INV-RO-1', revisionNo: 1 },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invoiceId: { in: ['inv-1', 'inv-ext-1'] } },
      }),
    )
    expect(res.body.items).toHaveLength(2)
    expect(res.body.items[0].purpose).toBe('RENTAL_EXTENSION')
    expect(res.body.items[1].purpose).toBe('RENTAL_PAYMENT')
  })

  // =========================================================================
  // Test 3: Đơn có phí gia hạn và technical reversal -> thể hiện đúng trạng thái
  // =========================================================================
  it('3. Đơn có phí gia hạn và technical reversal -> thể hiện đúng trạng thái từng dòng', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: 'inv-ext', invoiceNo: 'RENTAL-EXT-2', revisionNo: 2 },
    ])
    prismaMock.payment.count.mockResolvedValue(1)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-ext-rev',
        invoiceId: 'inv-ext',
        amount: new Prisma.Decimal(250000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'REDIRECT',
        paymentGateway: 'momo',
        createdAt: new Date('2026-10-19T11:00:00Z'),
        paidAt: new Date('2026-10-19T11:05:00Z'),
        application: { status: 'REJECTED', reasonCode: 'LATE_PAYMENT' },
        refundsViaPaymentId: [
          {
            id: 'ref-tech-1',
            amount: new Prisma.Decimal(250000),
            status: 'SUCCEEDED',
            purpose: 'TECHNICAL_REVERSAL',
            createdAt: new Date('2026-10-19T11:10:00Z'),
            refundedAt: new Date('2026-10-19T11:15:00Z'),
          },
        ],
        invoice: { id: 'inv-ext', invoiceNo: 'RENTAL-EXT-2', revisionNo: 2 },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    const paymentItem = res.body.items[0]
    expect(paymentItem.purpose).toBe('RENTAL_EXTENSION')
    expect(paymentItem.status).toBe('SUCCEEDED')
    expect(paymentItem.applicationStatus).toBe('REJECTED')
    expect(paymentItem.refunds).toHaveLength(1)
    expect(paymentItem.refunds[0]).toMatchObject({
      refundId: 'ref-tech-1',
      purpose: 'TECHNICAL_REVERSAL',
      status: 'SUCCEEDED',
      amount: '250000.00',
    })
  })

  // =========================================================================
  // Test 4: USER A truy cập payment history của USER B -> 403
  // =========================================================================
  it('4. USER A truy cập payment history của USER B -> trả về HTTP 403 FORBIDDEN', async () => {
    // Order belongs to userB, but actor is userA
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userB })

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer token-userA')
      .expect(403)

    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  // =========================================================================
  // Test 5: Đơn không tồn tại -> 404
  // =========================================================================
  it('5. Đơn không tồn tại -> trả về HTTP 404 RENTAL_ORDER_NOT_FOUND', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue(null)

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(404)

    expect(res.body.error.code).toBe('RENTAL_ORDER_NOT_FOUND')
  })

  // =========================================================================
  // Test 6: Refund SUCCEEDED thuộc grouped refund 3 items -> không nhân 3 lần
  // =========================================================================
  it('6. Một Refund SUCCEEDED thuộc grouped refund 3 items -> hiển thị một khoản refund duy nhất, không nhân 3', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv-1', invoiceNo: 'INV-1' }])
    prismaMock.payment.count.mockResolvedValue(1)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(3000000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        paidAt: new Date('2026-10-18T10:05:00Z'),
        application: { status: 'APPLIED' },
        refundsViaPaymentId: [
          // Single Refund object representing 3 grouped returned units
          {
            id: 'ref-grouped-1',
            amount: new Prisma.Decimal(1500000),
            status: 'SUCCEEDED',
            purpose: 'DEPOSIT',
            createdAt: new Date('2026-10-18T15:00:00Z'),
            refundedAt: new Date('2026-10-18T15:05:00Z'),
          },
        ],
        invoice: { id: 'inv-1', invoiceNo: 'INV-1' },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items[0].refunds).toHaveLength(1)
    expect(res.body.items[0].refunds[0].amount).toBe('1500000.00')
  })

  // =========================================================================
  // Test 7: Refund PENDING/FAILED không được tính thành tiền đã hoàn
  // =========================================================================
  it('7. Refund PENDING/FAILED không được xem như tiền đã hoàn tất (refundedAt = null, status giữ nguyên)', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv-1', invoiceNo: 'INV-1' }])
    prismaMock.payment.count.mockResolvedValue(1)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1500000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        paidAt: new Date('2026-10-18T10:05:00Z'),
        application: { status: 'APPLIED' },
        refundsViaPaymentId: [
          {
            id: 'ref-pending',
            amount: new Prisma.Decimal(1000000),
            status: 'PENDING',
            purpose: 'DEPOSIT',
            createdAt: new Date('2026-10-18T14:00:00Z'),
            refundedAt: null,
          },
        ],
        invoice: { id: 'inv-1', invoiceNo: 'INV-1' },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    const refund = res.body.items[0].refunds[0]
    expect(refund.status).toBe('PENDING')
    expect(refund.refundedAt).toBeNull()
  })

  // =========================================================================
  // Test 8: USER có RENTAL + BOOKING + TRAIL_ACCESS -> account history trả đầy đủ và phân loại đúng
  // =========================================================================
  it('8. USER có RENTAL + BOOKING + TRAIL_ACCESS -> user transactions trả đầy đủ và phân loại đúng nguồn', async () => {
    const rawRows = [
      {
        id: 'pay-rental',
        kind: 'PAYMENT',
        source: 'RENTAL',
        sourceId: 'ro-uuid-1',
        paymentId: 'pay-rental',
        refundId: null,
        invoiceId: 'inv-rental',
        amount: '1500000.00',
        currency: 'VND',
        status: 'SUCCEEDED',
        financialEffect: 'DEBIT',
        paymentMethod: 'QR',
        createdAt: new Date('2026-10-18T12:00:00Z'),
        completedAt: new Date('2026-10-18T12:05:00Z'),
        invoiceNo: 'INV-RENTAL',
        revisionNo: 1,
        refundPurpose: null,
      },
      {
        id: 'ref-booking',
        kind: 'REFUND',
        source: 'BOOKING',
        sourceId: 'bk-uuid-1',
        paymentId: 'pay-bk',
        refundId: 'ref-booking',
        invoiceId: 'inv-booking',
        amount: '500000.00',
        currency: 'VND',
        status: 'SUCCEEDED',
        financialEffect: 'CREDIT',
        paymentMethod: 'REDIRECT',
        createdAt: new Date('2026-10-18T11:00:00Z'),
        completedAt: new Date('2026-10-18T11:05:00Z'),
        invoiceNo: 'INV-BK',
        revisionNo: 1,
        refundPurpose: 'BOOKING_CANCELLATION',
      },
      {
        id: 'pay-trail',
        kind: 'PAYMENT',
        source: 'TRAIL_ACCESS',
        sourceId: 'trail-uuid-1',
        paymentId: 'pay-trail',
        refundId: null,
        invoiceId: 'inv-trail',
        amount: '100000.00',
        currency: 'VND',
        status: 'SUCCEEDED',
        financialEffect: 'DEBIT',
        paymentMethod: 'QR',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        completedAt: new Date('2026-10-18T10:02:00Z'),
        invoiceNo: 'INV-TRAIL',
        revisionNo: 1,
        refundPurpose: null,
      },
    ]

    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawRows)
      .mockResolvedValueOnce([{ total: 3 }])

    const res = await request(app.getHttpServer())
      .get('/api/v1/user/transactions')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items).toHaveLength(3)
    expect(res.body.items[0]).toMatchObject({
      source: 'RENTAL',
      kind: 'PAYMENT',
      financialEffect: 'DEBIT',
      description: 'Thanh toán đơn thuê thiết bị',
    })
    expect(res.body.items[1]).toMatchObject({
      source: 'BOOKING',
      kind: 'REFUND',
      financialEffect: 'CREDIT',
      description: 'Hoàn tiền huỷ đặt chỗ chuyến đi',
    })
    expect(res.body.items[2]).toMatchObject({
      source: 'TRAIL_ACCESS',
      kind: 'PAYMENT',
      financialEffect: 'DEBIT',
      description: 'Thanh toán quyền truy cập cung đường',
    })
  })

  // =========================================================================
  // Test 9: USER A không xem được giao dịch của USER B trong global history
  // =========================================================================
  it('9. USER A không xem được giao dịch của USER B trong global history (scoped strictly by token userId)', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])

    await request(app.getHttpServer())
      .get('/api/v1/user/transactions')
      .set('Authorization', 'Bearer token-userA')
      .expect(200)

    // Verify $queryRaw was called with actorUserId = userA
    const calls = prismaMock.$queryRaw.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    // The query template strings contain userA
    const sqlObj = calls[0][0]
    expect(JSON.stringify(sqlObj)).toContain(userA)
    expect(JSON.stringify(sqlObj)).not.toContain(userB)
  })

  // =========================================================================
  // Test 10: Payment SUCCEEDED nhưng PaymentApplication REJECTED -> hiển thị trung thực
  // =========================================================================
  it('10. Payment SUCCEEDED nhưng PaymentApplication REJECTED -> hiển thị trung thực số tiền đã thu (financialEffect = DEBIT)', async () => {
    const rawRows = [
      {
        id: 'pay-rejected-app',
        kind: 'PAYMENT',
        source: 'RENTAL',
        sourceId: 'ro-1',
        paymentId: 'pay-rejected-app',
        refundId: null,
        invoiceId: 'inv-1',
        amount: '1500000.00',
        currency: 'VND',
        status: 'SUCCEEDED',
        financialEffect: 'DEBIT',
        paymentMethod: 'QR',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        completedAt: new Date('2026-10-18T10:05:00Z'),
        invoiceNo: 'INV-1',
        revisionNo: 1,
        refundPurpose: null,
      },
    ]

    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawRows)
      .mockResolvedValueOnce([{ total: 1 }])

    const res = await request(app.getHttpServer())
      .get('/api/v1/user/transactions')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items[0]).toMatchObject({
      status: 'SUCCEEDED',
      financialEffect: 'DEBIT',
      amount: '1500000.00',
    })
  })

  // =========================================================================
  // Test 11: Payment paidAt = null không được suy ra bằng worker timestamp
  // =========================================================================
  it('11. Payment paidAt = null không được suy ra bằng worker timestamp (completedAt = null)', async () => {
    const rawRows = [
      {
        id: 'pay-pending',
        kind: 'PAYMENT',
        source: 'RENTAL',
        sourceId: 'ro-1',
        paymentId: 'pay-pending',
        refundId: null,
        invoiceId: 'inv-1',
        amount: '1500000.00',
        currency: 'VND',
        status: 'PROCESSING',
        financialEffect: 'NONE',
        paymentMethod: 'QR',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        completedAt: null, // paidAt is null
        invoiceNo: 'INV-1',
        revisionNo: 1,
        refundPurpose: null,
      },
    ]

    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawRows)
      .mockResolvedValueOnce([{ total: 1 }])

    const res = await request(app.getHttpServer())
      .get('/api/v1/user/transactions')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items[0].completedAt).toBeNull()
    expect(res.body.items[0].financialEffect).toBe('NONE')
  })

  // =========================================================================
  // Test 12: Lọc theo status/source/kind/time và pagination đúng
  // =========================================================================
  it('12. Lọc theo status/source/kind/time và pagination đúng parameters', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])

    await request(app.getHttpServer())
      .get('/api/v1/user/transactions?source=RENTAL&kind=PAYMENT&status=SUCCEEDED&from=2026-10-01T00:00:00.000Z&to=2026-10-31T23:59:59.999Z&page=2&pageSize=10')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    const calls = prismaMock.$queryRaw.mock.calls
    const sqlObj = calls[0][0]
    const sqlStr = JSON.stringify(sqlObj)
    expect(sqlStr).toContain('RENTAL')
    expect(sqlStr).toContain('SUCCEEDED')
    expect(sqlObj.values).toEqual(expect.arrayContaining([10, 10]))
  })

  // =========================================================================
  // Test 13: Hai transaction cùng timestamp vẫn sắp xếp ổn định, tie-break id
  // =========================================================================
  it('13. Hai transaction cùng timestamp vẫn sắp xếp ổn định qua tie-break id DESC', async () => {
    const sameTime = new Date('2026-10-18T10:00:00.000Z')
    const rawRows = [
      {
        id: 'uuid-b',
        kind: 'PAYMENT',
        source: 'RENTAL',
        sourceId: 'ro-1',
        paymentId: 'uuid-b',
        refundId: null,
        invoiceId: 'inv-1',
        amount: '100000.00',
        currency: 'VND',
        status: 'SUCCEEDED',
        financialEffect: 'DEBIT',
        paymentMethod: 'QR',
        createdAt: sameTime,
        completedAt: sameTime,
        invoiceNo: 'INV-1',
        revisionNo: 1,
        refundPurpose: null,
      },
      {
        id: 'uuid-a',
        kind: 'REFUND',
        source: 'RENTAL',
        sourceId: 'ro-1',
        paymentId: 'uuid-b',
        refundId: 'uuid-a',
        invoiceId: 'inv-1',
        amount: '50000.00',
        currency: 'VND',
        status: 'SUCCEEDED',
        financialEffect: 'CREDIT',
        paymentMethod: 'QR',
        createdAt: sameTime,
        completedAt: sameTime,
        invoiceNo: 'INV-1',
        revisionNo: 1,
        refundPurpose: 'DEPOSIT',
      },
    ]

    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawRows)
      .mockResolvedValueOnce([{ total: 2 }])

    const res = await request(app.getHttpServer())
      .get('/api/v1/user/transactions')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items[0].id).toBe('uuid-b')
    expect(res.body.items[1].id).toBe('uuid-a')
  })

  // =========================================================================
  // Test 14: Không expose provider secrets, raw gatewayPayload hoặc idempotencyKey
  // =========================================================================
  it('14. Tuyệt đối không expose gatewayPayload, idempotencyKey hay provider secrets', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv-1', invoiceNo: 'INV-1' }])
    prismaMock.payment.count.mockResolvedValue(1)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        invoiceId: 'inv-1',
        amount: new Prisma.Decimal(1500000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        paymentGateway: 'vnpay',
        idempotencyKey: 'SECRET_IDEMPOTENCY_KEY_123',
        gatewayPayload: { secretKey: 'SECRET_API_KEY', bankAuth: 'PRIVATE' },
        createdAt: new Date('2026-10-18T10:00:00Z'),
        paidAt: new Date('2026-10-18T10:05:00Z'),
        application: { status: 'APPLIED' },
        refundsViaPaymentId: [],
        invoice: { id: 'inv-1', invoiceNo: 'INV-1' },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    const rawResponse = JSON.stringify(res.body)
    expect(rawResponse).not.toContain('SECRET_IDEMPOTENCY_KEY')
    expect(rawResponse).not.toContain('SECRET_API_KEY')
    expect(rawResponse).not.toContain('gatewayPayload')
  })

  // =========================================================================
  // Test 15: GET không phát sinh mutation, outbox hoặc payment provider call
  // =========================================================================
  it('15. GET read-only requests không phát sinh mutation, outbox hoặc payment provider checkout call', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv-1', invoiceNo: 'INV-1' }])
    prismaMock.payment.count.mockResolvedValue(0)
    prismaMock.payment.findMany.mockResolvedValue([])

    await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(paymentsMock.createRentalCheckout).not.toHaveBeenCalled()
    expect(prismaMock.payment.create).not.toHaveBeenCalled()
  })

  // =========================================================================
  // Test 16: Hai GET routes mới không ảnh hưởng POST /rental-orders/:id/payments
  // =========================================================================
  it('16. POST /rental-orders/:id/payments (RB-API-204) vẫn hoạt động nguyên vẹn', async () => {
    paymentsMock.createRentalCheckout.mockResolvedValue({
      httpStatus: 201,
      body: {
        paymentId: 'new-pay-uuid',
        status: 'PROCESSING',
      },
    })

    const res = await request(app.getHttpServer())
      .post(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .set('Idempotency-Key', 'idemp-key-123')
      .send({ paymentMethod: 'QR' })
      .expect(201)

    expect(res.body.paymentId).toBe('new-pay-uuid')
    expect(paymentsMock.createRentalCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        rentalOrderId: orderId,
        actorUserId: userA,
        idempotencyKey: 'idemp-key-123',
        paymentMethod: 'QR',
      }),
    )
  })

  // =========================================================================
  // Test 17: Payment with null paymentMethod returns null (never defaulted to QR)
  // =========================================================================
  it('17. Payment với paymentMethod là null trong DB -> API trả về null, tuyệt đối không tự gán QR', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.invoice.findMany.mockResolvedValue([{ id: 'inv-legacy', invoiceNo: 'INV-LEGACY' }])
    prismaMock.payment.count.mockResolvedValue(1)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-legacy-null-method',
        invoiceId: 'inv-legacy',
        amount: new Prisma.Decimal(1200000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: null, // Legacy unrecorded method
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        paidAt: new Date('2026-10-18T10:05:00Z'),
        application: { status: 'APPLIED' },
        refundsViaPaymentId: [],
        invoice: { id: 'inv-legacy', invoiceNo: 'INV-LEGACY' },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].paymentMethod).toBeNull()

    // Test API 2 user transactions with null method
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'pay-legacy-null-method',
          kind: 'PAYMENT',
          source: 'RENTAL',
          sourceId: orderId,
          paymentId: 'pay-legacy-null-method',
          refundId: null,
          invoiceId: 'inv-legacy',
          amount: '1200000.00',
          currency: 'VND',
          status: 'SUCCEEDED',
          financialEffect: 'DEBIT',
          paymentMethod: null,
          createdAt: new Date('2026-10-18T10:00:00Z'),
          completedAt: new Date('2026-10-18T10:05:00Z'),
          invoiceNo: 'INV-LEGACY',
          revisionNo: 1,
          refundPurpose: null,
          isExtension: false,
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }])

    const resUser = await request(app.getHttpServer())
      .get('/api/v1/user/transactions')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(resUser.body.items[0].paymentMethod).toBeNull()
  })

  // =========================================================================
  // Test 18: Ordinary invoice revision (revisionNo > 1) is NOT misclassified as extension
  // =========================================================================
  it('18. Hóa đơn sửa đổi thông thường (revisionNo > 1) không bị gán sai thành RENTAL_EXTENSION', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.rentalExtensionRequest.findMany.mockResolvedValue([]) // No extension request!
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: 'inv-rev2', invoiceNo: 'INV-RO-REV2', revisionNo: 2 },
    ])
    prismaMock.payment.count.mockResolvedValue(1)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-rev2',
        invoiceId: 'inv-rev2',
        amount: new Prisma.Decimal(1500000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-18T10:00:00Z'),
        paidAt: new Date('2026-10-18T10:05:00Z'),
        application: { status: 'APPLIED' },
        refundsViaPaymentId: [],
        invoice: { id: 'inv-rev2', invoiceNo: 'INV-RO-REV2', revisionNo: 2 },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items[0].purpose).toBe('RENTAL_PAYMENT')

    // Test API 2 user transactions description with isExtension = false
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'pay-rev2',
          kind: 'PAYMENT',
          source: 'RENTAL',
          sourceId: orderId,
          paymentId: 'pay-rev2',
          refundId: null,
          invoiceId: 'inv-rev2',
          amount: '1500000.00',
          currency: 'VND',
          status: 'SUCCEEDED',
          financialEffect: 'DEBIT',
          paymentMethod: 'QR',
          createdAt: new Date('2026-10-18T10:00:00Z'),
          completedAt: new Date('2026-10-18T10:05:00Z'),
          invoiceNo: 'INV-RO-REV2',
          revisionNo: 2,
          refundPurpose: null,
          isExtension: false,
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }])

    const resUser = await request(app.getHttpServer())
      .get('/api/v1/user/transactions')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(resUser.body.items[0].description).toBe('Thanh toán đơn thuê thiết bị')
  })

  // =========================================================================
  // Test 19: Grounded extension relation produces RENTAL_EXTENSION
  // =========================================================================
  it('19. Hóa đơn liên kết với RentalExtensionRequest được xác định đúng là RENTAL_EXTENSION', async () => {
    prismaMock.rentalOrder.findUnique.mockResolvedValue({ id: orderId, userId: userA })
    prismaMock.rentalExtensionRequest.findMany.mockResolvedValue([
      { invoiceId: 'inv-grounded-ext' },
    ])
    prismaMock.invoice.findMany.mockResolvedValue([
      { id: 'inv-grounded-ext', invoiceNo: 'INV-CUSTOM-001', revisionNo: 1 },
    ])
    prismaMock.payment.count.mockResolvedValue(1)
    prismaMock.payment.findMany.mockResolvedValue([
      {
        id: 'pay-ext-grounded',
        invoiceId: 'inv-grounded-ext',
        amount: new Prisma.Decimal(300000),
        currency: 'VND',
        status: 'SUCCEEDED',
        paymentMethod: 'QR',
        paymentGateway: 'vnpay',
        createdAt: new Date('2026-10-19T10:00:00Z'),
        paidAt: new Date('2026-10-19T10:05:00Z'),
        application: { status: 'APPLIED' },
        refundsViaPaymentId: [],
        invoice: { id: 'inv-grounded-ext', invoiceNo: 'INV-CUSTOM-001', revisionNo: 1 },
      },
    ])

    const res = await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items[0].purpose).toBe('RENTAL_EXTENSION')
  })

  // =========================================================================
  // Test 20: Legacy refund mapping and domain ID consistency
  // =========================================================================
  it('20. Refund thuộc BOOKING không bị gán nhầm sourceId từ Rental và ngược lại', async () => {
    const bookingId = '44444444-4444-4444-a444-444444444444'
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'ref-booking-1',
          kind: 'REFUND',
          source: 'BOOKING',
          sourceId: bookingId, // Selected accurately based on invoice_type
          paymentId: 'pay-book-1',
          refundId: 'ref-booking-1',
          invoiceId: 'inv-book-1',
          amount: '500000.00',
          currency: 'VND',
          status: 'SUCCEEDED',
          financialEffect: 'CREDIT',
          paymentMethod: 'QR',
          createdAt: new Date('2026-10-18T10:00:00Z'),
          completedAt: new Date('2026-10-18T10:05:00Z'),
          invoiceNo: 'INV-BOOK-1',
          revisionNo: 1,
          refundPurpose: 'BOOKING_CANCELLATION',
          isExtension: false,
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }])

    const res = await request(app.getHttpServer())
      .get('/api/v1/user/transactions?kind=REFUND')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)

    expect(res.body.items[0].source).toBe('BOOKING')
    expect(res.body.items[0].sourceId).toBe(bookingId)
    expect(res.body.items[0].description).toBe('Hoàn tiền huỷ đặt chỗ chuyến đi')
  })

  // =========================================================================
  // Test 21: Strict input validation on both APIs (invalid status, invalid dates, range mismatch)
  // =========================================================================
  it('21. Input validation từ chối status không hợp lệ, ngày sai format hoặc from > to bằng HTTP 400', async () => {
    // API 1: Invalid status
    await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments?status=INVALID_STATUS`)
      .set('Authorization', 'Bearer valid-token')
      .expect(400)

    // API 1: Invalid from date format
    await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments?from=not-a-real-date`)
      .set('Authorization', 'Bearer valid-token')
      .expect(400)

    // API 1: from > to
    await request(app.getHttpServer())
      .get(`/api/v1/rental-orders/${orderId}/payments?from=2026-10-25T00:00:00Z&to=2026-10-20T00:00:00Z`)
      .set('Authorization', 'Bearer valid-token')
      .expect(400)

    // API 2: Invalid status
    await request(app.getHttpServer())
      .get('/api/v1/user/transactions?status=NOT_A_VALID_STATUS')
      .set('Authorization', 'Bearer valid-token')
      .expect(400)

    // API 2: kind=REFUND and status=EXPIRED
    await request(app.getHttpServer())
      .get('/api/v1/user/transactions?kind=REFUND&status=EXPIRED')
      .set('Authorization', 'Bearer valid-token')
      .expect(400)

    // API 2: from > to
    await request(app.getHttpServer())
      .get('/api/v1/user/transactions?from=2026-10-25T00:00:00Z&to=2026-10-20T00:00:00Z')
      .set('Authorization', 'Bearer valid-token')
      .expect(400)
  })
})

