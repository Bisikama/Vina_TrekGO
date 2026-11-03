// NotificationsService kéo theo @nestjs/mongoose (ESM, Jest không nạp được); consumer chỉ cần deliverEvent.
jest.mock('../notifications.service', () => ({ NotificationsService: class {} }))
jest.mock('@nestjs/schedule', () => ({ Interval: () => () => {} }))

import { RentalNotificationConsumer } from './rental-notification.consumer'
import { PaymentNotificationConsumer } from './payment-notification.consumer'
import { BookingNotificationConsumer } from './booking-notification.consumer'
import { NotificationOutboxEvent } from './notification-outbox-drain'

const ORDER = '11111111-1111-4111-8111-111111111111'
const CUSTOMER = '22222222-2222-4222-8222-222222222222'

const event = (eventType: string, payload: Record<string, unknown>, over: Partial<NotificationOutboxEvent> = {}) => ({
  id: 'evt-1',
  eventType,
  aggregateType: 'RentalOrder',
  aggregateId: ORDER,
  payload,
  ...over,
})

function rentalConsumer() {
  const db: any = {
    rentalOrder: { findUnique: jest.fn().mockResolvedValue({ id: ORDER, userId: CUSTOMER }) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }, { id: 'inv-1' }]) },
    refund: { findUnique: jest.fn().mockResolvedValue({ providerPayload: { sandboxSimulation: { origin: 'x' } } }) },
  }
  const service = { deliverEvent: jest.fn().mockResolvedValue(undefined) }
  return { db, service, consumer: new RentalNotificationConsumer(db, service as any) as any }
}

describe('RentalNotificationConsumer.deliver', () => {
  it('fans a grade-shortage alert out to active ADMIN and STAFF_INVENTORY users only', async () => {
    const { db, service, consumer } = rentalConsumer()
    await consumer.deliver(
      event('RENTAL_ACTION_REQUIRED', { orderId: ORDER, reason: 'GRADE_DOWNGRADE_CAPACITY_SHORTAGE' }),
    )
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: { in: ['ADMIN', 'STAFF_INVENTORY'] }, status: 'ACTIVE' } }),
    )
    expect(service.deliverEvent.mock.calls.map((c: any[]) => c[2].userId)).toEqual(['admin-1', 'inv-1'])
    expect(service.deliverEvent.mock.calls.every((c: any[]) => c[1] === 'RENTAL_ACTION_REQUIRED:STAFF')).toBe(true)
  })

  it('sends customer notifications to the order owner without looking up staff', async () => {
    const { db, service, consumer } = rentalConsumer()
    await consumer.deliver(
      event('RENTAL_ORDER_CANCELLED', {
        orderId: ORDER,
        cancellationSource: 'TRIP',
        financialStatus: 'REFUND_PENDING',
      }),
    )
    expect(db.user.findMany).not.toHaveBeenCalled()
    expect(service.deliverEvent).toHaveBeenCalledTimes(1)
    expect(service.deliverEvent).toHaveBeenCalledWith(
      'evt-1',
      'RENTAL_ORDER_CANCELLED',
      expect.objectContaining({ userId: CUSTOMER }),
    )
  })

  it('skips internal operational events without touching the database', async () => {
    const { db, service, consumer } = rentalConsumer()
    await consumer.deliver(event('RENTAL_ACTION_REQUIRED', { orderId: ORDER, kind: 'TRANSFER_DELAYED' }))
    expect(db.rentalOrder.findUnique).not.toHaveBeenCalled()
    expect(service.deliverEvent).not.toHaveBeenCalled()
  })

  it('retries a staff alert instead of completing it when no staff account is active', async () => {
    const { db, service, consumer } = rentalConsumer()
    db.user.findMany.mockResolvedValue([])
    await expect(
      consumer.deliver(
        event('RENTAL_ACTION_REQUIRED', { orderId: ORDER, reason: 'GRADE_DOWNGRADE_CAPACITY_SHORTAGE' }),
      ),
    ).rejects.toThrow('NO_STAFF_RECIPIENT')
    expect(service.deliverEvent).not.toHaveBeenCalled()
  })

  it('completes silently when the order no longer exists', async () => {
    const { db, service, consumer } = rentalConsumer()
    db.rentalOrder.findUnique.mockResolvedValue(null)
    await consumer.deliver(event('RENTAL_PAID', { orderId: ORDER }))
    expect(service.deliverEvent).not.toHaveBeenCalled()
  })

  it('marks deposit refunds that were simulated in sandbox', async () => {
    const { service, consumer } = rentalConsumer()
    await consumer.deliver(event('DEPOSIT_REFUND_SUCCEEDED', { orderId: ORDER, refundId: 'ref-1' }))
    expect(service.deliverEvent.mock.calls[0][2].title).toMatch(/^\[Sandbox\]/)
  })
})

describe('PaymentNotificationConsumer.deliver', () => {
  function paymentConsumer(refund: Record<string, unknown> | null) {
    const db: any = { refund: { findUnique: jest.fn().mockResolvedValue(refund) } }
    const service = { deliverEvent: jest.fn().mockResolvedValue(undefined) }
    return { service, consumer: new PaymentNotificationConsumer(db, service as any) as any }
  }
  const refundRow = (over: Record<string, unknown> = {}) => ({
    id: 'ref-1',
    status: 'SUCCEEDED',
    amount: { toString: () => '500000.00' },
    purpose: 'RENTAL_CANCELLATION',
    rentalOrderId: ORDER,
    providerPayload: null,
    bookingCancellation: null,
    payment: { invoice: { userId: CUSTOMER } },
    ...over,
  })
  const refundEvent = event(
    'REFUND_SUCCEEDED',
    { refundId: 'ref-1' },
    { aggregateType: 'Refund', aggregateId: 'ref-1' },
  )

  it('notifies the invoice owner once the provider confirmed the refund', async () => {
    const { service, consumer } = paymentConsumer(refundRow())
    await consumer.deliver(refundEvent)
    expect(service.deliverEvent).toHaveBeenCalledWith(
      'evt-1',
      'REFUND_SUCCEEDED',
      expect.objectContaining({ userId: CUSTOMER, referenceId: ORDER, notificationType: 'PAYMENT_REFUND' }),
    )
  })

  it('never says "refunded" when the refund row is not SUCCEEDED', async () => {
    const { service, consumer } = paymentConsumer(refundRow({ status: 'PROCESSING' }))
    await consumer.deliver(refundEvent)
    expect(service.deliverEvent).not.toHaveBeenCalled()
  })

  it('links booking-cancellation refunds to the booking and flags sandbox simulations', async () => {
    const { service, consumer } = paymentConsumer(
      refundRow({
        purpose: 'BOOKING_CANCELLATION',
        rentalOrderId: null,
        bookingCancellation: { bookingId: 'b-1' },
        providerPayload: { sandboxSimulation: { origin: 'x' } },
      }),
    )
    await consumer.deliver(refundEvent)
    expect(service.deliverEvent).toHaveBeenCalledWith(
      'evt-1',
      'REFUND_SUCCEEDED',
      expect.objectContaining({
        referenceType: 'BOOKING',
        referenceId: 'b-1',
        title: '[Sandbox] Hoàn tiền thành công',
      }),
    )
  })

  it('delivers PAYMENT_SUCCEEDED only for Payment aggregates', async () => {
    const payment = {
      id: 'pay-1',
      amount: { toString: () => '250000.00' },
      invoiceId: 'inv-1',
      paymentGateway: 'VNPAY',
      invoice: { userId: CUSTOMER, invoiceNo: 'INV-1' },
    }
    const db: any = { payment: { findUnique: jest.fn().mockResolvedValue(payment) } }
    const service = { deliverEvent: jest.fn().mockResolvedValue(undefined) }
    const consumer = new PaymentNotificationConsumer(db, service as any) as any
    const succeeded = (aggregateType: string) =>
      event('PAYMENT_SUCCEEDED', { paymentId: 'pay-1' }, { aggregateType, aggregateId: 'pay-1' })

    await consumer.deliver(succeeded('Invoice'))
    expect(service.deliverEvent).not.toHaveBeenCalled()
    await consumer.deliver(succeeded('Payment'))
    expect(service.deliverEvent).toHaveBeenCalledWith(
      'evt-1',
      'PAYMENT_SUCCEEDED',
      expect.objectContaining({ userId: CUSTOMER, referenceId: 'pay-1', notificationType: 'PAYMENT_SUCCESS' }),
    )
  })
})

describe('BookingNotificationConsumer.loadContext', () => {
  it('looks up active private-trip members and ticket holders only for the events that need them', async () => {
    const db: any = {
      tripMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm-1' }]) },
      bookingParticipant: { findMany: jest.fn().mockResolvedValue([{ userId: 'h-1' }]) },
    }
    const consumer = new BookingNotificationConsumer(db, {} as any) as any
    expect(
      await consumer.loadContext({ id: 'e', eventType: 'PRIVATE_TRIP_CANCELLED', payload: { tripId: 't-1' } }),
    ).toEqual({
      memberUserIds: ['m-1'],
    })
    expect(db.tripMember.findMany).toHaveBeenCalledWith({
      where: { tripId: 't-1', status: 'ACTIVE' },
      select: { userId: true },
    })
    expect(
      await consumer.loadContext({
        id: 'e',
        eventType: 'BOOKING_CANCELLED',
        payload: { bookingId: 'b-1', cancelSource: 'ORGANIZER' },
      }),
    ).toEqual({ participantUserIds: ['h-1'] })
    expect(
      await consumer.loadContext({
        id: 'e',
        eventType: 'BOOKING_CANCELLED',
        payload: { bookingId: 'b-1', cancelSource: 'USER' },
      }),
    ).toEqual({})
    expect(db.bookingParticipant.findMany).toHaveBeenCalledTimes(1)
    // Người đã kết thúc vé trước đó (NO_SHOW/COMPLETED) không nhận "vé bị huỷ"; CANCELLED vẫn nhận vì huỷ booking đặt CANCELLED.
    expect(db.bookingParticipant.findMany).toHaveBeenCalledWith({
      where: { bookingId: 'b-1', userId: { not: null }, status: { notIn: ['NO_SHOW', 'COMPLETED'] } },
      select: { userId: true },
    })
  })
})
