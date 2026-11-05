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
import { SandboxRefundSimulationService } from './sandbox-refund-simulation.service'
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
        { provide: SandboxRefundSimulationService, useValue: {} },
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


import { AdminCashflowController } from './admin-cashflow.controller'

describe('Admin Cashflow & System-Wide Transaction Ledger APIs', () => {
  let app: INestApplication
  let prismaMock: {
    payment: { findUnique: jest.Mock }
    $queryRaw: jest.Mock
  }

  const adminId = '99999999-9999-4999-a999-999999999999'
  const customerId = '11111111-1111-4111-a111-111111111111'
  const paymentId = 'dd950c38-90e2-4d8c-a644-758a5d14130e'

  beforeEach(async () => {
    prismaMock = {
      payment: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AdminCashflowController],
      providers: [
        PaymentHistoryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RefundsService, useValue: {} },
        { provide: SandboxRefundSimulationService, useValue: {} },
        { provide: PaymentRecoveryService, useValue: {} },
        { provide: PaymentsService, useValue: {} },
        { provide: PaymentsPort, useClass: SharedPaymentsPort },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalFilters(new GlobalErrorFilter())
    app.use((req: any, _res: any, next: any) => {
      if (req.headers.authorization) {
        req[REQUEST_USER_KEY] = { id: adminId, role: 'ADMIN' }
      }
      next()
    })

    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('22. GET /api/v1/admin/transactions trả về danh sách giao dịch toàn hệ thống kèm thông tin khách hàng và đối soát', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: paymentId,
          kind: 'PAYMENT',
          source: 'BOOKING',
          sourceId: '753d38ba-48ae-44b4-a8bf-37d9f0a6203c',
          paymentId,
          refundId: null,
          invoiceId: 'e99bc2e5-462b-4630-92e6-226a15f6f20f',
          userId: customerId,
          userFullName: 'Nguyễn Văn A',
          userEmail: 'nguyenvana@example.com',
          amount: '2250000.00',
          currency: 'VND',
          status: 'SUCCEEDED',
          financialEffect: 'DEBIT',
          paymentGateway: 'vnpay',
          paymentMethod: 'REDIRECT',
          transactionRef: '15721162',
          reconcileStatus: 'RESOLVED',
          reconciliationRequired: false,
          createdAt: new Date('2026-10-31T09:20:00.000Z'),
          completedAt: new Date('2026-10-31T09:24:42.000Z'),
          invoiceNo: 'INV-BK-20261031-001',
          revisionNo: 1,
          refundPurpose: null,
          executionMode: null,
          confirmationSource: null,
          isExtension: false,
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }])

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/transactions?source=BOOKING&gateway=vnpay&search=INV-BK')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({
      id: paymentId,
      kind: 'PAYMENT',
      source: 'BOOKING',
      invoiceNo: 'INV-BK-20261031-001',
      user: {
        id: customerId,
        fullName: 'Nguyễn Văn A',
        email: 'nguyenvana@example.com',
      },
      amount: '2250000.00',
      financialEffect: 'DEBIT',
      paymentGateway: 'vnpay',
      transactionRef: '15721162',
      reconcileStatus: 'RESOLVED',
      reconciliationRequired: false,
    })
  })

  it('23. GET /api/v1/admin/cashflow/summary tính toán đúng tổng thu, tổng chi, dòng tiền ròng và phân rã theo nguồn/cổng', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          totalInflowAmount: '45000000',
          totalInflowCount: 25,
          totalOutflowAmount: '8500000',
          totalOutflowCount: 8,
          pendingInflowAmount: '3000000',
          pendingInflowCount: 2,
          pendingOutflowAmount: '1800000',
          pendingOutflowCount: 1,
          reconciliationRequiredCount: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          bucket: 'BOOKING',
          inflowAmount: '30000000',
          inflowCount: 15,
          outflowAmount: '3500000',
          outflowCount: 3,
        },
        {
          bucket: 'RENTAL',
          inflowAmount: '15000000',
          inflowCount: 10,
          outflowAmount: '5000000',
          outflowCount: 5,
        },
      ])
      .mockResolvedValueOnce([
        {
          bucket: 'vnpay',
          inflowAmount: '45000000',
          inflowCount: 25,
          outflowAmount: '8500000',
          outflowCount: 8,
        },
      ])

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/cashflow/summary?from=2026-10-01T00:00:00.000Z&to=2026-10-31T23:59:59.999Z')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)

    expect(res.body.totals).toEqual({
      totalInflowAmount: '45000000.00',
      totalInflowCount: 25,
      totalOutflowAmount: '8500000.00',
      totalOutflowCount: 8,
      netCashflowAmount: '36500000.00',
      pendingInflowAmount: '3000000.00',
      pendingInflowCount: 2,
      pendingOutflowAmount: '1800000.00',
      pendingOutflowCount: 1,
      reconciliationRequiredCount: 2,
    })
    expect(res.body.bySource).toHaveLength(3)
    expect(res.body.bySource[0]).toMatchObject({
      source: 'BOOKING',
      inflowAmount: '30000000.00',
      outflowAmount: '3500000.00',
      netAmount: '26500000.00',
    })
    expect(res.body.byGateway[0]).toMatchObject({
      gateway: 'vnpay',
      netAmount: '36500000.00',
    })
  })

  it('24. GET /api/v1/admin/payments/:id trả chi tiết payment, đối soát và refunds liên quan mà không lộ secrets', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({
      id: paymentId,
      invoiceId: 'e99bc2e5-462b-4630-92e6-226a15f6f20f',
      amount: new Prisma.Decimal(2250000),
      currency: 'VND',
      status: 'SUCCEEDED',
      paymentGateway: 'vnpay',
      providerEnvironment: 'SANDBOX',
      paymentMethod: 'REDIRECT',
      transactionRef: '15721162',
      merchantRequestRef: 'REQ-15721162',
      idempotencyKey: 'TOP_SECRET_IDEMPOTENCY_KEY',
      gatewayPayload: { secretHash: 'DONT_LEAK' },
      reconcileStatus: 'RESOLVED',
      retryCount: 0,
      lastCheckedAt: new Date('2026-10-31T09:24:42.000Z'),
      lastErrorCode: null,
      createdAt: new Date('2026-10-31T09:20:00.000Z'),
      paidAt: new Date('2026-10-31T09:24:42.000Z'),
      invoice: {
        id: 'e99bc2e5-462b-4630-92e6-226a15f6f20f',
        invoiceNo: 'INV-BK-20261031-001',
        status: 'PARTIALLY_REFUNDED',
        invoiceType: 'BOOKING',
        bookingId: '753d38ba-48ae-44b4-a8bf-37d9f0a6203c',
        rentalOrderId: null,
        trailAccessId: null,
        user: {
          id: customerId,
          fullName: 'Nguyễn Văn A',
          email: 'nguyenvana@example.com',
        },
      },
      application: {
        status: 'APPLIED',
        reasonCode: null,
      },
      allocations: [],
      refundsViaPaymentId: [
        {
          id: '01e76d7f-e0a7-4b0a-9633-d0e13bd20436',
          amount: new Prisma.Decimal(1800000),
          currency: 'VND',
          status: 'SUCCEEDED',
          purpose: 'BOOKING_CANCELLATION',
          reconcileStatus: 'RESOLVED',
          executionMode: 'PROVIDER_API',
          paymentGateway: 'vnpay',
          providerEnvironment: 'SANDBOX',
          providerPayload: { sandboxSimulation: { status: 'SUCCEEDED' } },
          refundTransactionRef: 'SIM-01E76D7F',
          createdAt: new Date('2026-10-31T10:00:00.000Z'),
          refundedAt: new Date('2026-10-31T10:05:00.000Z'),
          manualRefund: null,
        },
      ],
    })

    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/payments/${paymentId}`)
      .set('Authorization', 'Bearer admin-token')
      .expect(200)

    expect(res.body.paymentId).toBe(paymentId)
    expect(res.body.owner.email).toBe('nguyenvana@example.com')
    expect(res.body.refunds).toHaveLength(1)
    expect(res.body.refunds[0].confirmationSource).toBe('SANDBOX_SIMULATION')
    const raw = JSON.stringify(res.body)
    expect(raw).not.toContain('TOP_SECRET_IDEMPOTENCY_KEY')
    expect(raw).not.toContain('DONT_LEAK')
  })

  it('25. defaults and ALL/BOTH aliases only include VNPay; other gateways use the global validation envelope', async () => {
    for (const gateway of ['', 'ALL', 'BOTH', 'vnpay']) {
      prismaMock.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }])
      const res = await request(app.getHttpServer()).get('/api/v1/admin/transactions' + (gateway ? '?gateway=' + gateway : ''))
        .set('Authorization', 'Bearer admin-token').expect(200)
      expect(res.body.appliedFilters.gatewaysIncluded).toEqual(['vnpay'])
      const sql = prismaMock.$queryRaw.mock.calls.at(-1)[0].sql
      expect(sql).toContain("p.provider_environment = 'SANDBOX'")
      expect(sql).toContain("r.execution_mode::text = 'SANDBOX_SIMULATED'")
    }
    for (const gateway of ['payos', 'momo', 'mock']) {
      const res = await request(app.getHttpServer()).get('/api/v1/admin/transactions?gateway=' + gateway)
        .set('Authorization', 'Bearer admin-token').expect(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(res.body.meta.contractVersion).toBeDefined()
    }
  })

  it('26. GET /api/v1/admin/transactions bóc tách đúng breakdown (phí thuê, tiền cọc, tiền khấu trừ cọc) và lọc theo direction/category', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: '01e76d7f-e0a7-4b0a-9633-d0e13bd20436',
          kind: 'REFUND',
          source: 'RENTAL',
          sourceId: '88888888-8888-4888-a888-888888888888',
          paymentId,
          refundId: '01e76d7f-e0a7-4b0a-9633-d0e13bd20436',
          invoiceId: 'e99bc2e5-462b-4630-92e6-226a15f6f20f',
          userId: customerId,
          userFullName: 'Nguyễn Văn A',
          userEmail: 'nguyenvana@example.com',
          amount: '900000.00',
          currency: 'VND',
          status: 'PENDING',
          financialEffect: 'NONE',
          paymentGateway: 'vnpay',
          providerEnvironment: 'SANDBOX',
          paymentMethod: 'QR',
          transactionRef: null,
          payosOrderCode: null,
          reconcileStatus: 'IDLE',
          reconciliationRequired: true,
          createdAt: new Date('2026-10-31T10:00:00.000Z'),
          completedAt: null,
          invoiceNo: 'INV-RT-20261031-002',
          revisionNo: 1,
          refundPurpose: 'DEPOSIT',
          executionMode: 'PROVIDER_API',
          confirmationSource: null,
          manualRefundStatus: null,
          isExtension: false,
          serviceFeeAmount: '0',
          rentalFeeAmount: '0',
          depositAmount: '900000',
          deductionAmount: '100000',
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }])

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/transactions?gateway=vnpay&direction=CASH_OUT&category=DEPOSIT_REFUND')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)

    expect(res.body.items[0]).toMatchObject({
      kind: 'REFUND',
      direction: 'CASH_OUT',
      source: 'RENTAL',
      category: 'DEPOSIT_REFUND',
      paymentGateway: 'vnpay',
      payosOrderCode: null,
      manualRefundStatus: null,
      canSimulateSandbox: true,
      breakdown: {
        serviceFeeAmount: '0.00',
        rentalFeeAmount: '0.00',
        depositAmount: '900000.00',
        deductionAmount: '100000.00',
        isExtension: false,
      },
    })
  })

  it('27. GET /api/v1/admin/transactions/summary trả về KPI mở rộng (doanh thu dịch vụ, phí thuê, tiền cọc, khấu trừ cọc, hàng đợi PayOS/VNPay)', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          totalInflowAmount: '45000000',
          totalInflowCount: 25,
          totalOutflowAmount: '8500000',
          totalOutflowCount: 8,
          pendingInflowAmount: '3000000',
          pendingInflowCount: 2,
          pendingOutflowAmount: '1800000',
          pendingOutflowCount: 1,
          reconciliationRequiredCount: 2,
          bookingInflowAmount: '30000000',
          rentalFeeInflowAmount: '7500000',
          rentalExtensionInflowAmount: '1500000',
          rentalDepositInflowAmount: '5000000',
          trailAccessInflowAmount: '1000000',
          depositOutflowAmount: '4500000',
          bookingCancellationOutflowAmount: '3500000',
          rentalCancellationOutflowAmount: '500000',
          technicalReversalOutflowAmount: '0',
          retainedDepositDeductionAmount: '500000',
          payosManualRefundPendingCount: 0,
          vnpaySandboxPendingRefundCount: 1,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/transactions/summary?gateway=BOTH')
      .set('Authorization', 'Bearer admin-token')
      .expect(200)

    expect(res.body.appliedFilters).toEqual({
      gateway: 'BOTH',
      gatewaysIncluded: ['vnpay'],
      source: null,
    })
    expect(res.body.totals).toMatchObject({
      totalInflowAmount: '45000000.00',
      serviceRevenueAmount: '40000000.00',
      bookingInflowAmount: '30000000.00',
      rentalFeeInflowAmount: '7500000.00',
      rentalExtensionInflowAmount: '1500000.00',
      rentalDepositInflowAmount: '5000000.00',
      trailAccessInflowAmount: '1000000.00',
      depositOutflowAmount: '4500000.00',
      retainedDepositDeductionAmount: '500000.00',
      activeDepositHeldAmount: '0.00',
      payosManualRefundPendingCount: 0,
      vnpaySandboxPendingRefundCount: 1,
    })
  })

  it('28. rejects PayOS and production payment/refund detail outside the sandbox report', async () => {
    ;(prismaMock as any).refund = { findUnique: jest.fn() }
    for (const paymentGateway of ['payos', 'momo', 'vnpay']) {
      const payment = { paymentGateway, providerEnvironment: 'PRODUCTION' }
      prismaMock.payment.findUnique.mockResolvedValue(payment)
      await request(app.getHttpServer()).get('/api/v1/admin/payments/' + paymentId)
        .set('Authorization', 'Bearer admin-token').expect(404)
      ;(prismaMock as any).refund.findUnique.mockResolvedValue({ ...payment, payment, executionMode: 'PROVIDER_API' })
      await request(app.getHttpServer()).get('/api/v1/admin/refunds/' + paymentId)
        .set('Authorization', 'Bearer admin-token').expect(404)
    }
  })
})
