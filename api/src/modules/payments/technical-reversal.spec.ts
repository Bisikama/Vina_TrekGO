import { InvoiceType, Prisma } from '@prisma/client'
import { RefundsService } from './refunds.service'
import { TechnicalReversalWorker } from './technical-reversal.worker'
import type { TechnicalReversalReason } from './technical-reversal-reasons'

jest.mock('@nestjs/schedule', () => ({ Interval: () => () => undefined }))

const RENTAL_REASONS: TechnicalReversalReason[] = [
  'PAYMENT_TIMESTAMP_UNTRUSTED',
  'PRIMARY_RENTAL_LOCATION_NOT_VERIFIED',
  'HOLD_EXPIRED_BEFORE_PROCESSING',
  'POST_DUE_PAYMENT',
  'EXTENSION_NOT_APPLICABLE',
  'EXTENSION_ACCEPTANCE_MISSING',
  'HANDOVER_DOCUMENT_REQUIRED_FOR_APPENDIX',
  'EXTENSION_DOCUMENT_LIMIT',
]

function fixture(invoiceType: InvoiceType, reasonCode: TechnicalReversalReason) {
  const paymentId = 'payment-1'
  const invoiceId = 'invoice-1'
  const event = {
    id: 'event-1',
    aggregateId: paymentId,
    aggregateType: 'Payment',
    eventType: 'TECHNICAL_REVERSAL_REQUESTED',
    status: 'PENDING',
    payload: { schemaVersion: 1, paymentId, invoiceId, reasonCode },
  }
  const payment = {
    id: paymentId,
    invoiceId,
    invoice: { invoiceType, rentalOrderId: 'order-1' },
    application: { status: 'REJECTED', invoiceId, reasonCode },
    status: 'SUCCEEDED',
    amount: new Prisma.Decimal(100),
    currency: 'VND',
    reconcileStatus: 'RESOLVED',
    providerEnvironment: 'MOCK',
    merchantAccountKey: 'merchant-1',
    merchantRequestRef: 'merchant-request-1',
    paymentGateway: 'momo',
    allocations: [{ id: 'allocation-1', amount: new Prisma.Decimal(100), rentalOrderLine: { orderId: 'order-1' } }],
  }
  let refund: any = null
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ now: new Date('2026-10-20T00:00:00Z') }]),
    payment: {
      findUnique: jest.fn().mockResolvedValue(payment),
      findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
    },
    paymentOutboxEvent: {
      findUnique: jest.fn().mockImplementation(async () => event),
      update: jest.fn().mockImplementation(async ({ data }) => Object.assign(event, data)),
    },
    paymentConsumerReceipt: { upsert: jest.fn() },
    refund: {
      findFirst: jest.fn().mockImplementation(async () => refund),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      create: jest.fn().mockImplementation(async ({ data }) => {
        refund = { ...data, status: 'PENDING', refundedAt: null }
        return refund
      }),
    },
  }
  const db: any = { ...tx, $transaction: jest.fn(async (work) => work(tx)) }
  const refunds = new RefundsService(db, {} as any)
  const worker = new TechnicalReversalWorker(db, { requestRefund: (command: any) => refunds.requestRefund(command) } as any)
  const command = () => ({
    paymentId,
    businessActionId: `payment:${paymentId}:technical-reversal:v1`,
    purpose: 'TECHNICAL_REVERSAL' as const,
    reasonCode,
    amount: '100',
    idempotencyKey: `payment:${paymentId}:technical-reversal:v1`,
    source: {},
  })
  return { event, payment, tx, refunds, worker, command }
}

describe('Hoàn kỹ thuật Rental sau khi cổng đã thu tiền', () => {
  it('hóa đơn gia hạn bị từ chối chỉ thành REFUNDED sau xác nhận hoàn từ cổng', async () => {
    const f = fixture('RENTAL', 'EXTENSION_NOT_APPLICABLE')
    const payment = {
      ...f.payment, invoiceId: 'invoice-1', merchantRequestRef: 'merchant-request-1',
      transactionRef: null, application: { status: 'REJECTED' },
    }
    const refund: any = {
      id: 'refund-1', paymentId: payment.id, payment, purpose: 'TECHNICAL_REVERSAL',
      amount: new Prisma.Decimal(100), currency: 'VND', status: 'PENDING',
      reconcileStatus: 'SCHEDULED', paymentGateway: 'momo',
      providerEnvironment: 'MOCK', merchantAccountKey: 'merchant-1',
      merchantRefundRef: 'refund-ref-1', refundTransactionRef: null,
    }
    f.tx.refund.findFirst.mockResolvedValue(refund)
    f.tx.refund.findUniqueOrThrow = jest.fn().mockImplementation(async () => refund)
    f.tx.refund.update = jest.fn().mockImplementation(async ({ data }) => Object.assign(refund, data))
    f.tx.refund.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal(100) } })
    f.tx.paymentOutboxEvent.create = jest.fn()
    f.tx.invoice = { update: jest.fn() }
    f.tx.$queryRaw.mockResolvedValue([{ now: new Date('2026-10-20T08:00:00Z') }])
    const providerEvent = {
      kind: 'REFUND' as const, gateway: 'momo', environment: 'MOCK' as const,
      merchantAccountKey: 'merchant-1', providerEventId: 'provider-refund-1',
      merchantRequestRef: 'merchant-request-1', merchantRefundRef: 'refund-ref-1',
      transactionRef: null, refundTransactionRef: null,
      amount: '100', currency: 'VND', occurredAt: '2026-10-20T08:00:00Z',
    }

    await f.refunds.applyEvent({ ...providerEvent, status: 'PROCESSING' })
    expect(f.tx.invoice.update).not.toHaveBeenCalled()
    await f.refunds.applyEvent({ ...providerEvent, status: 'SUCCEEDED' })
    expect(f.tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: payment.invoiceId }, data: expect.objectContaining({ status: 'REFUNDED' }),
    }))
  })

  it.each(RENTAL_REASONS)('chấp nhận lý do Rental %s, tạo một refund và xử lý lặp an toàn', async (reason) => {
    const f = fixture('RENTAL', reason)

    const reserved = await f.worker.consume(f.event.id)
    expect(f.tx.refund.create).toHaveBeenCalledTimes(1)
    expect(f.tx.refund.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reasonCode: reason, amount: f.payment.amount, purpose: 'TECHNICAL_REVERSAL' }),
    }))
    expect(reserved?.status).toBe('PENDING')
    expect(f.event.status).toBe('PROCESSED')

    await f.worker.consume(f.event.id)
    await f.refunds.requestRefund(f.command())
    expect(f.tx.refund.create).toHaveBeenCalledTimes(1)
  })

  it.each(['BOOKING', 'TRAIL_ACCESS'] as const)('giữ nguyên lý do hoàn kỹ thuật chung cho %s', async (invoiceType) => {
    const f = fixture(invoiceType, 'DOMAIN_NOT_ELIGIBLE')

    await f.worker.consume(f.event.id)
    expect(f.tx.refund.create).toHaveBeenCalledTimes(1)
    expect(f.event.status).toBe('PROCESSED')
  })

  it.each(['BOOKING', 'TRAIL_ACCESS'] as const)('không mở quyền hoàn bằng mã Rental cho %s', async (invoiceType) => {
    const f = fixture(invoiceType, 'PAYMENT_TIMESTAMP_UNTRUSTED')

    await expect(f.worker.consume(f.event.id)).rejects.toThrow('Invalid technical reversal decision')
    await expect(f.refunds.requestRefund(f.command())).rejects.toMatchObject({ code: 'REFUND_SOURCE_INVALID' })
    expect(f.tx.refund.create).not.toHaveBeenCalled()
    expect(f.event.status).toBe('PENDING')
  })

  it('từ chối quyết định hoàn giả mạo dù mã Rental nằm trong danh sách hợp lệ', async () => {
    const f = fixture('RENTAL', 'PAYMENT_TIMESTAMP_UNTRUSTED')
    f.event.payload.invoiceId = 'invoice-khac'

    await expect(f.worker.consume(f.event.id)).rejects.toThrow('Invalid technical reversal decision')
    await expect(f.refunds.requestRefund(f.command())).rejects.toMatchObject({ code: 'REFUND_SOURCE_INVALID' })
    expect(f.tx.refund.create).not.toHaveBeenCalled()
  })
})
