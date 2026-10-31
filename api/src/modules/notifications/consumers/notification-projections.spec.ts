import { rentalNotificationProjection } from './rental-notification.projection'
import { paymentNotificationProjection, RefundSucceededContext } from './payment-notification.projection'
import { bookingNotificationProjection } from './booking-notification.projection'
import { NotificationType as N, ReferenceType as R } from '../schemas/notification.enums'

const ORDER = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const TRIP = '33333333-3333-4333-8333-333333333333'
const BOOKING = '44444444-4444-4444-8444-444444444444'
const HOLDER = '55555555-5555-4555-8555-555555555555'
const CREATOR = '66666666-6666-4666-8666-666666666666'
const MEMBER = '77777777-7777-4777-8777-777777777777'

const rental = (eventType: string, payload: Record<string, unknown>, extra = {}) =>
  rentalNotificationProjection(eventType, payload, { orderId: ORDER, shortageAlertHours: 24, ...extra })

describe('rentalNotificationProjection', () => {
  it('never claims money was refunded when an order is cancelled; wording follows the source and financial state', () => {
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ cancellationSource: 'TRIP', financialStatus: 'REFUND_PENDING' }, /Chuyến đi đã bị huỷ.*đang được xử lý/],
      [{ cancellationSource: 'BOOKING', financialStatus: 'UNPAID' }, /Đặt chỗ chuyến đi.*không bị trừ tiền/],
      [{ cancellationSource: 'MEMBERSHIP', financialStatus: 'PAID' }, /không còn là thành viên.*đang kiểm tra/],
      [{ financialStatus: 'REFUND_PENDING' }, /^Đơn thuê thiết bị #11111111 đã được huỷ\. Khoản hoàn tiền đang/],
    ]
    for (const [payload, pattern] of cases) {
      const [d] = rental('RENTAL_ORDER_CANCELLED', { orderId: ORDER, reason: 'Trip cancelled', ...payload })
      expect(d.audience).toBe('CUSTOMER')
      expect(d.data.notificationType).toBe(N.RENTAL_ORDER_CANCELLED)
      expect(d.data.content).toMatch(pattern)
      expect(d.data.content).not.toMatch(/đã được hoàn về|đã hoàn/)
    }
  })

  it('keeps the system-fault cancellation message', () => {
    const [d] = rental('RENTAL_ORDER_CANCELLED', { reason: 'SYSTEM_FAULT_CANCELLATION', refundRef: 'r-1' })
    expect(d.data.content).toMatch(/TrekGo không thể chuẩn bị đủ thiết bị/)
    expect(d.data.metadata).toMatchObject({ refundId: 'r-1' })
  })

  it('tells the customer the rental stays active when the trip is cancelled while they hold equipment', () => {
    for (const reason of [
      'TRIP_CANCELLED_WITH_ACTIVE_RENTAL',
      'BOOKING_CANCELLED_WITH_ACTIVE_RENTAL',
      'ACTIVE_RENTAL_MEMBERSHIP_REVOKED_CUSTODY_PRESERVED',
    ]) {
      const [d] = rental('RENTAL_ACTION_REQUIRED', { reason, rentalEndAt: '2026-11-05T03:00:00.000Z' })
      expect(d.audience).toBe('CUSTOMER')
      expect(d.data.notificationType).toBe(N.RENTAL_ACTION_REQUIRED)
      expect(d.data.content).toMatch(/vẫn còn hiệu lực vì bạn đang giữ thiết bị/)
      // 03:00 UTC = 10:00 giờ Việt Nam
      expect(d.data.content).toContain('10:00')
    }
  })

  it('alerts staff only (never the customer) about grade-downgrade shortages', () => {
    const [detected] = rental('RENTAL_ACTION_REQUIRED', {
      reason: 'GRADE_DOWNGRADE_CAPACITY_SHORTAGE',
      gradeReviewId: 'rev-1',
    })
    expect(detected).toMatchObject({ audience: 'STAFF', data: { notificationType: N.RENTAL_STAFF_ACTION_REQUIRED } })
    const [deadline] = rental('RENTAL_ACTION_REQUIRED', {
      kind: 'GRADE_SHORTAGE_HANDOVER_DEADLINE',
      rentalStartAt: '2026-11-05T03:00:00.000Z',
      gradeReviewId: 'rev-1',
    })
    expect(deadline.audience).toBe('STAFF')
    expect(deadline.data.content).toMatch(/còn dưới 24 giờ/)
    // Đơn còn ACTION_REQUIRED có thể vì lý do khác: chỉ nhắc kiểm tra, không khẳng định còn thiếu.
    expect(deadline.data.content).toMatch(/Hãy kiểm tra/)
    expect(deadline.data.content).not.toMatch(/vẫn thiếu/)
    expect(detected.semanticType).not.toBe('RENTAL_ACTION_REQUIRED')
  })

  it('ignores other operational action-required events', () => {
    expect(rental('RENTAL_ACTION_REQUIRED', { reason: 'RESCHEDULE_CAPACITY_CONFLICT' })).toEqual([])
    expect(rental('RENTAL_ACTION_REQUIRED', { kind: 'TRANSFER_DELAYED' })).toEqual([])
  })

  it('announces a new return due time after a trip reschedule', () => {
    const [d] = rental('RENTAL_SCHEDULE_NOTICE_ISSUED', {
      operationalReturnDueAt: '2026-11-06T10:30:00.000Z',
      feeChanged: false,
    })
    expect(d.data.notificationType).toBe(N.RENTAL_SCHEDULE_CHANGED)
    expect(d.data.content).toMatch(/17:30.*Phí thuê không thay đổi/)
    expect(() => rental('RENTAL_SCHEDULE_NOTICE_ISSUED', {})).toThrow('RENTAL_SCHEDULE_NOTICE_INVALID')
  })

  it('labels sandbox-simulated deposit refunds', () => {
    const [real] = rental('DEPOSIT_REFUND_SUCCEEDED', { refundId: 'r' })
    const [sandbox] = rental('DEPOSIT_REFUND_SUCCEEDED', { refundId: 'r' }, { refundSimulated: true })
    expect(real.data.title).toBe('Hoàn tiền cọc thiết bị')
    expect(sandbox.data.title).toMatch(/^\[Sandbox\]/)
    expect(sandbox.data.content).toMatch(/không có tiền thật/)
  })
  it('falls back to generic wording for cancellations without cancellationSource (events from before the field)', () => {
    const [d] = rental('RENTAL_ORDER_CANCELLED', { financialStatus: 'REFUND_PENDING' })
    expect(d.data.content).toMatch(/^Đơn thuê thiết bị #11111111 đã được huỷ\./)
    expect(d.data.content).toMatch(/đang được xử lý/)
    expect(d.data.metadata).toMatchObject({ cancellationSource: null })
  })

  it('tells the customer about retained deposits and rejects unsupported event types', () => {
    const [d] = rental('DEPOSIT_RETAINED', { itemId: 'item-1' })
    expect(d).toMatchObject({ audience: 'CUSTOMER', data: { notificationType: N.RENTAL_DAMAGE_REPORTED } })
    expect(() => rental('SOMETHING_ELSE', {})).toThrow('UNSUPPORTED_RENTAL_NOTIFICATION_EVENT')
  })
})

describe('paymentNotificationProjection', () => {
  const refund = (over: Partial<RefundSucceededContext> = {}): RefundSucceededContext => ({
    kind: 'REFUND',
    refundId: 'ref-1',
    userId: USER,
    amount: '1180000.00',
    purpose: 'RENTAL_CANCELLATION',
    rentalOrderId: ORDER,
    bookingId: null,
    simulated: false,
    ...over,
  })

  it('reports a confirmed rental cancellation refund with its amount and links the order', () => {
    const [d] = paymentNotificationProjection('REFUND_SUCCEEDED', refund())
    expect(d.userId).toBe(USER)
    expect(d.data).toMatchObject({
      notificationType: N.PAYMENT_REFUND,
      referenceType: R.RENTAL_ORDER,
      referenceId: ORDER,
    })
    expect(d.data.content).toMatch(/TrekGo đã hoàn 1\.180\.000.*đơn thuê thiết bị #11111111/)
  })

  it('links booking cancellation refunds to the booking', () => {
    const [d] = paymentNotificationProjection(
      'REFUND_SUCCEEDED',
      refund({ purpose: 'BOOKING_CANCELLATION', rentalOrderId: null, bookingId: BOOKING }),
    )
    expect(d.data).toMatchObject({ referenceType: R.BOOKING, referenceId: BOOKING })
  })

  it('skips purposes notified elsewhere or not customer-facing yet', () => {
    for (const purpose of ['DEPOSIT', 'TECHNICAL_REVERSAL', 'TRAIL_ACCESS'])
      expect(paymentNotificationProjection('REFUND_SUCCEEDED', refund({ purpose }))).toEqual([])
  })

  it('labels sandbox-simulated refunds', () => {
    const [d] = paymentNotificationProjection('REFUND_SUCCEEDED', refund({ simulated: true }))
    expect(d.data.title).toBe('[Sandbox] Hoàn tiền thành công')
    expect(d.data.metadata).toMatchObject({ sandboxSimulated: true })
  })
})

describe('bookingNotificationProjection — trip cancellations', () => {
  const cancelled = (cancelSource: string, participantUserIds: string[] = []) =>
    bookingNotificationProjection(
      'BOOKING_CANCELLED',
      { tripId: TRIP, userId: USER, bookingId: BOOKING, cancelSource },
      { participantUserIds },
    )

  it('keeps the self-cancel wording when the customer cancels', () => {
    const deliveries = cancelled('USER', [HOLDER])
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0].data.title).toBe('Hủy đặt chỗ thành công')
  })

  it('says the organizer cancelled and also tells ticket holders, without money details', () => {
    const [buyer, holder, ...rest] = cancelled('ORGANIZER', [USER, HOLDER])
    expect(rest).toEqual([])
    expect(buyer.data).toMatchObject({ userId: USER, notificationType: N.TRIP_CANCELLED, title: 'Chuyến đi đã bị huỷ' })
    expect(buyer.data.content).toMatch(/đang được xử lý/)
    expect(holder.data.userId).toBe(HOLDER)
    expect(holder.data.content).not.toMatch(/hoàn tiền/)
    expect(JSON.stringify(holder.data)).not.toContain(BOOKING)
  })

  it('words an admin cancellation as TrekGo-cancelled and still notifies ticket holders', () => {
    const [buyer, holder] = cancelled('ADMIN', [HOLDER])
    expect(buyer.data).toMatchObject({ notificationType: N.BOOKING_CANCELLED, title: 'Đặt chỗ của bạn đã bị huỷ' })
    expect(buyer.data.content).toMatch(/^TrekGo đã huỷ/)
    expect(holder.data).toMatchObject({ userId: HOLDER, title: 'Vé chuyến đi đã bị huỷ' })
  })

  it('sends nothing for a private-trip update that carries no schedule windows', () => {
    expect(
      bookingNotificationProjection(
        'PRIVATE_TRIP_UPDATED',
        { tripId: TRIP, creatorId: CREATOR },
        { memberUserIds: [MEMBER] },
      ),
    ).toEqual([])
  })

  it('notifies private-trip members except the creator on cancellation', () => {
    const deliveries = bookingNotificationProjection(
      'PRIVATE_TRIP_CANCELLED',
      { tripId: TRIP, creatorId: CREATOR, reason: 'Thời tiết xấu' },
      { memberUserIds: [CREATOR, MEMBER] },
    )
    expect(deliveries.map((d) => d.data.userId)).toEqual([MEMBER])
    expect(deliveries[0].data.content).toMatch(/Lý do: Thời tiết xấu/)
  })

  it('notifies private-trip members only when the schedule window changes', () => {
    const window = { startAt: '2026-11-10T00:00:00.000Z', endAt: '2026-11-12T00:00:00.000Z' }
    const same = bookingNotificationProjection(
      'PRIVATE_TRIP_UPDATED',
      { tripId: TRIP, creatorId: CREATOR, oldWindow: window, newWindow: window },
      { memberUserIds: [MEMBER] },
    )
    expect(same).toEqual([])
    const moved = bookingNotificationProjection(
      'PRIVATE_TRIP_UPDATED',
      {
        tripId: TRIP,
        creatorId: CREATOR,
        oldWindow: window,
        newWindow: { ...window, startAt: '2026-11-11T00:00:00.000Z' },
      },
      { memberUserIds: [MEMBER] },
    )
    expect(moved).toHaveLength(1)
    expect(moved[0].data.notificationType).toBe(N.TRIP_SCHEDULE_CHANGED)
  })
})
