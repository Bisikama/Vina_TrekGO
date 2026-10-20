import { Prisma } from '@prisma/client'
import { RentalPaymentConsumer } from './rental-payment.consumer'

jest.mock('./rental-membership.guard', () => ({ rentalMembershipValid: jest.fn().mockResolvedValue(true) }))
jest.mock('../shared/primary-inventory-location', () => ({
  resolveActivePrimaryRentalLocation: jest.fn().mockResolvedValue('primary-location'),
}))

function paymentFixture(prepBufferMinutes: number) {
  const paidAt = new Date('2026-10-20T08:00:00Z')
  const handoverAt = new Date('2026-10-25T08:00:00Z')
  const returnAt = new Date('2026-10-27T08:00:00Z')
  const decimal = (value: number) => new Prisma.Decimal(value)
  const line = {
    id: 'line-1', orderId: 'order-1', productId: 'product-1', quantity: 1, chargedDays: 1,
    dailyPriceSnapshot: decimal(100), depositPerUnitSnapshot: decimal(50),
    lineRentalFee: decimal(100), lineDeposit: decimal(50),
    product: { requiresDeepReturnInspection: false },
    rentalQuantityReservationsViaOrderLineId: [{
      status: 'HELD', productId: 'product-1', quantity: 1,
      holdExpiresAt: new Date('2026-10-20T09:00:00Z'),
      occupiedFrom: new Date(handoverAt.getTime() - Math.max(prepBufferMinutes, 0) * 60_000),
      occupiedUntil: new Date(returnAt.getTime() + 1440 * 60_000),
    }],
  }
  const order = {
    id: 'order-1', tripId: 'trip-1', bookingId: null, userId: 'user-1', quoteId: 'quote-1',
    status: 'PENDING_PAYMENT', financialStatus: 'PAYMENT_PENDING', currency: 'VND',
    totalAmount: decimal(150), rentalFee: decimal(100), totalDeposit: decimal(50),
    paymentExpiresAt: new Date('2026-10-20T09:00:00Z'),
    plannedHandoverAt: handoverAt, plannedReturnAt: returnAt,
    rentalStartAt: handoverAt, rentalEndAt: returnAt,
    occupiedStartAt: new Date(handoverAt.getTime() - Math.max(prepBufferMinutes, 0) * 60_000),
    quote: null,
    policySnapshot: { prepBufferMinutes, returnBufferMinutes: 1440, cleaningBufferMinutes: 1440 },
    rentalOrderLinesViaOrderId: [line],
  }
  const invoice = {
    id: 'invoice-1', invoiceType: 'RENTAL', rentalOrderId: order.id,
    status: 'PENDING_PAYMENT', userId: order.userId, currency: 'VND',
    totalAmount: decimal(150), expiresAt: order.paymentExpiresAt,
  }
  const payment = {
    id: 'payment-1', invoiceId: invoice.id, invoice, status: 'SUCCEEDED', paidAt,
    amount: decimal(150), currency: 'VND', reconcileStatus: 'RESOLVED',
    application: { invoiceId: invoice.id, status: 'PENDING' },
    allocations: [
      { rentalOrderLineId: line.id, component: 'RENTAL_FEE', amount: decimal(100) },
      { rentalOrderLineId: line.id, component: 'RENTAL_DEPOSIT', amount: decimal(50) },
    ],
  }
  const event = {
    id: 'event-1', eventType: 'PAYMENT_SUCCEEDED', aggregateType: 'Payment', aggregateId: payment.id,
    payload: { schemaVersion: 1, paymentId: payment.id, invoiceId: invoice.id },
  }
  const tx: any = {
    $queryRaw: jest.fn(async (parts: TemplateStringsArray) => {
      if (parts[0].includes('clock_timestamp')) return [{ now: paidAt }]
      if (parts[0].includes('payment_outbox_events')) return [{ id: event.id }]
      return []
    }),
    paymentOutboxEvent: {
      findUnique: jest.fn().mockResolvedValue(event), findUniqueOrThrow: jest.fn().mockResolvedValue(event),
      create: jest.fn(), update: jest.fn(),
    },
    payment: {
      findUnique: jest.fn().mockResolvedValue({ ...payment, invoice: { ...invoice, rentalOrder: order } }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
    },
    rentalOrder: { findUniqueOrThrow: jest.fn().mockResolvedValue(order), update: jest.fn() },
    paymentConsumerReceipt: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    rentalExtensionRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    paymentApplication: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    rentalQuote: { findUnique: jest.fn().mockResolvedValue({ policySnapshot: { primaryRentalInventoryLocationId: 'primary-location' } }) },
    rentalQuantityReservation: { updateMany: jest.fn() },
    invoice: { update: jest.fn() },
    inventoryTask: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    rentalOutboxEvent: { create: jest.fn() },
  }
  const db: any = { $transaction: jest.fn(async (work) => work(tx)) }
  return { tx, consumer: new RentalPaymentConsumer(db) }
}

describe('Rental payment: occupied window fallback', () => {
  it('áp dụng payment khi công suất đã giữ đủ 12 giờ', async () => {
    const { tx, consumer } = paymentFixture(720)
    await consumer.consume('event-1')
    expect(tx.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'APPLIED' }),
    }))
    expect(tx.paymentOutboxEvent.create).not.toHaveBeenCalled()
  })

  it.each([0, 360])('từ chối payment từ đơn cũ chỉ giữ %i phút', async (prep) => {
    const { tx, consumer } = paymentFixture(prep)
    await consumer.consume('event-1')
    expect(tx.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REJECTED', reasonCode: 'DOMAIN_NOT_ELIGIBLE' }),
    }))
    expect(tx.paymentOutboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'TECHNICAL_REVERSAL_REQUESTED' }),
    }))
  })

  it('từ chối snapshot có prep âm và phát hoàn kỹ thuật', async () => {
    const { tx, consumer } = paymentFixture(-1)
    await consumer.consume('event-1')
    expect(tx.paymentApplication.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'REJECTED', reasonCode: 'DOMAIN_NOT_ELIGIBLE' }),
    }))
    expect(tx.paymentOutboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'TECHNICAL_REVERSAL_REQUESTED' }),
    }))
  })
})
