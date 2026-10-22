import { Prisma } from '@prisma/client'
import { cancelPendingRentalChargesWithTx, reserveLifecycleRentalRefundWithTx } from './rental-cancellation-refund'
import { RefundsService } from '../../payments/refunds.service'

const decimal = (value: number) => new Prisma.Decimal(value)

function fixture() {
  const order = {
    id: 'order-1', bookingId: 'booking-1', status: 'PAID', financialStatus: 'PAID',
    rentalFee: decimal(100), totalDeposit: decimal(50),
    rentalStartAt: new Date('2026-11-01T08:00:00Z'),
    rentalPolicy: { freeCancellationHours: 24 },
  }
  const payment = {
    id: 'payment-1', amount: decimal(150), status: 'SUCCEEDED', currency: 'VND',
    invoice: { rentalOrderId: order.id, invoiceType: 'RENTAL' },
    application: { status: 'APPLIED' }, reconcileStatus: 'RESOLVED',
    paymentGateway: 'momo', providerEnvironment: 'MOCK',
    merchantAccountKey: 'merchant-1', merchantRequestRef: 'request-1',
    allocations: [
      { id: 'deposit-1', component: 'RENTAL_DEPOSIT', amount: decimal(50) },
      { id: 'fee-1', component: 'RENTAL_FEE', amount: decimal(100) },
    ],
  }
  const tx: any = {
    bookingCancellation: { findFirst: jest.fn().mockResolvedValue({ source: 'USER', cancelledAt: new Date('2026-10-31T08:00:00Z') }) },
    rentalExtensionRequest: { count: jest.fn().mockResolvedValue(0) },
    payment: {
      findMany: jest.fn().mockResolvedValue([{ id: payment.id, amount: payment.amount }]),
      count: jest.fn().mockResolvedValue(1),
      findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
      updateMany: jest.fn(),
    },
    invoice: { findMany: jest.fn().mockResolvedValue([{ id: 'invoice-1' }]), updateMany: jest.fn() },
    refund: {
      findUnique: jest.fn().mockResolvedValue(null),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      create: jest.fn().mockImplementation(async ({ data }) => ({ ...data, status: 'PENDING' })),
    },
    refundAllocation: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    rentalOutboxEvent: { upsert: jest.fn() },
  }
  const input = {
    order, source: 'TRIP' as 'TRIP' | 'BOOKING', eventVersion: 2,
    now: new Date('2026-10-31T08:00:00Z'), reason: 'Cancelled before handover',
  }
  return { tx, order, input }
}

describe('Hủy Rental theo lifecycle trước bàn giao', () => {
  it('Trip do hệ thống hủy: đặt hoàn 100% phí và cọc, chờ xác nhận cổng', async () => {
    const { tx, input } = fixture()
    expect(await reserveLifecycleRentalRefundWithTx(tx, input)).toEqual({
      financialStatus: 'REFUND_PENDING', reviewReason: null,
    })
    expect(tx.refund.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: decimal(150), purpose: 'RENTAL_CANCELLATION' }),
    }))
    expect(tx.rentalOutboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ eventType: 'RENTAL_REFUND_REQUESTED' }),
    }))
  })

  it.each([
    ['đúng hạn 24 giờ', '2026-10-31T08:00:00Z', 150],
    ['sau hạn 24 giờ', '2026-10-31T08:00:01Z', 50],
  ])('USER hủy Booking %s: hoàn đúng phí và cọc', async (_label, cancelledAt, expected) => {
    const { tx, input } = fixture()
    tx.bookingCancellation.findFirst.mockResolvedValue({ source: 'USER', cancelledAt: new Date(cancelledAt) })
    expect(await reserveLifecycleRentalRefundWithTx(tx, { ...input, source: 'BOOKING' })).toEqual({
      financialStatus: 'REFUND_PENDING', reviewReason: null,
    })
    expect(tx.refund.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: decimal(expected) }),
    }))
  })

  it('không đoán tác nhân hủy Booking khi thiếu nguồn xác thực', async () => {
    const { tx, input } = fixture()
    tx.bookingCancellation.findFirst.mockResolvedValue(null)
    expect(await reserveLifecycleRentalRefundWithTx(tx, { ...input, source: 'BOOKING' })).toEqual({
      financialStatus: 'PAID', reviewReason: 'BOOKING_CANCELLATION_SOURCE_UNVERIFIED',
    })
    expect(tx.refund.create).not.toHaveBeenCalled()
  })

  it('đơn có gia hạn đã áp dụng phải đối soát nhiều payment trước khi hoàn', async () => {
    const { tx, input } = fixture()
    tx.rentalExtensionRequest.count.mockResolvedValue(1)
    expect(await reserveLifecycleRentalRefundWithTx(tx, input)).toEqual({
      financialStatus: 'PAID', reviewReason: 'MULTI_PAYMENT_RENTAL_CANCELLATION_REVIEW_REQUIRED',
    })
    expect(tx.refund.create).not.toHaveBeenCalled()
  })

  it('hủy invoice và payment chưa thu, giữ nguyên payment đã thành công', async () => {
    const { tx, order } = fixture()
    await cancelPendingRentalChargesWithTx(tx, order.id)
    expect(tx.invoice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ rentalOrderId: order.id, status: { in: ['DRAFT', 'PENDING_PAYMENT'] } }),
      data: expect.objectContaining({ status: 'CANCELLED' }),
    }))
    expect(tx.payment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ invoiceId: { in: ['invoice-1'] }, status: { in: ['PENDING', 'PROCESSING'] } }),
      data: expect.objectContaining({ status: 'CANCELLED' }),
    }))
  })

  it.each([
    [150, 'REFUNDED'],
    [50, 'PARTIALLY_REFUNDED'],
  ])('chỉ đổi trạng thái tài chính sau khi cổng xác nhận hoàn %i', async (refundAmount, finalStatus) => {
    const payment = {
      id: 'payment-1', invoiceId: 'invoice-1', merchantRequestRef: 'request-1',
      currency: 'VND', transactionRef: null, amount: decimal(150),
      application: { status: 'APPLIED' },
    }
    const refund: any = {
      id: 'refund-1', paymentId: payment.id, payment, rentalOrderId: 'order-1',
      purpose: 'RENTAL_CANCELLATION', amount: decimal(refundAmount), currency: 'VND',
      status: 'PENDING', reconcileStatus: 'SCHEDULED', paymentGateway: 'momo',
      providerEnvironment: 'MOCK', merchantAccountKey: 'merchant-1',
      merchantRefundRef: 'refund-ref-1', refundTransactionRef: null,
    }
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ now: new Date('2026-10-20T08:00:00Z') }]),
      refund: {
        findFirst: jest.fn().mockResolvedValue(refund),
        findUniqueOrThrow: jest.fn().mockImplementation(async () => refund),
        update: jest.fn().mockImplementation(async ({ data }) => Object.assign(refund, data)),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: decimal(refundAmount) } }),
      },
      paymentOutboxEvent: { create: jest.fn() },
      invoice: { update: jest.fn() },
      rentalOrder: { updateMany: jest.fn() },
    }
    const service = new RefundsService({ $transaction: async (work: any) => work(tx) } as any, {} as any)
    const providerEvent = {
      kind: 'REFUND' as const, gateway: 'momo', environment: 'MOCK' as const,
      merchantAccountKey: 'merchant-1', providerEventId: 'provider-event-1',
      merchantRequestRef: 'request-1', merchantRefundRef: 'refund-ref-1',
      transactionRef: null, refundTransactionRef: null, amount: String(refundAmount), currency: 'VND',
      occurredAt: '2026-10-20T08:00:00Z',
    }
    await service.applyEvent({ ...providerEvent, status: 'PROCESSING' })
    expect(tx.rentalOrder.updateMany).not.toHaveBeenCalled()
    await service.applyEvent({ ...providerEvent, status: 'SUCCEEDED' })
    expect(tx.rentalOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: refund.rentalOrderId, status: 'CANCELLED' },
      data: expect.objectContaining({ financialStatus: finalStatus }),
    }))
  })
})
