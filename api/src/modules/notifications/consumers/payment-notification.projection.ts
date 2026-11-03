import type { Notification } from '../schemas/notification.schema'
import { NotificationType as N, ReferenceType as R } from '../schemas/notification.enums'
import { formatVnd, shortRef } from './notification-format'

export const PAYMENT_NOTIFICATION_CONSUMER = 'payment-notifications-v1'

/** Phải khớp danh sách backfill trong migration 20261031090000_notification_receipts. */
export const paymentNotificationEvents = ['PAYMENT_SUCCEEDED', 'REFUND_SUCCEEDED'] as const

/** Hoàn cọc đã có thông báo riêng từ rental (DEPOSIT_REFUND_SUCCEEDED); các mục đích khác chưa báo khách. */
export const NOTIFIED_REFUND_PURPOSES = ['BOOKING_CANCELLATION', 'RENTAL_CANCELLATION'] as const

export type PaymentNotificationDelivery = {
  semanticType: string
  userId: string
  data: Omit<Partial<Notification>, 'userId'>
}

export type PaymentSucceededContext = {
  kind: 'PAYMENT'
  paymentId: string
  userId: string
  amount: string
  invoiceId: string
  invoiceNo: string | null
  paymentGateway: string | null
}

export type RefundSucceededContext = {
  kind: 'REFUND'
  refundId: string
  userId: string
  amount: string
  purpose: string
  /** Có giá trị khi refund thuộc đơn thuê (`refund.rentalOrderId`). */
  rentalOrderId: string | null
  /** Có giá trị khi refund thuộc huỷ booking (`refund.bookingCancellation.bookingId`). */
  bookingId: string | null
  simulated: boolean
}

/**
 * Hàm thuần: payment outbox event + dữ liệu đã tra → thông báo. Chỉ nói "đã hoàn" khi refund SUCCEEDED,
 * vì event REFUND_SUCCEEDED chỉ phát sau khi provider xác nhận.
 */
export function paymentNotificationProjection(
  eventType: string,
  ctx: PaymentSucceededContext | RefundSucceededContext,
): PaymentNotificationDelivery[] {
  if (eventType === 'PAYMENT_SUCCEEDED' && ctx.kind === 'PAYMENT') {
    return [
      {
        semanticType: eventType,
        userId: ctx.userId,
        data: {
          notificationType: N.PAYMENT_SUCCESS,
          referenceType: R.PAYMENT,
          referenceId: ctx.paymentId,
          title: 'Giao dịch thanh toán thành công',
          content:
            `Bạn đã thanh toán thành công số tiền ${formatVnd(ctx.amount)} cho hóa đơn ${ctx.invoiceNo ?? ''}.`.replace(
              / \.$/,
              '.',
            ),
          metadata: {
            invoiceId: ctx.invoiceId,
            paymentGateway: ctx.paymentGateway,
            amount: ctx.amount,
          },
        },
      },
    ]
  }
  if (eventType === 'REFUND_SUCCEEDED' && ctx.kind === 'REFUND') {
    if (!(NOTIFIED_REFUND_PURPOSES as readonly string[]).includes(ctx.purpose)) return []
    const forRental = ctx.purpose === 'RENTAL_CANCELLATION' && ctx.rentalOrderId
    const forBooking = ctx.purpose === 'BOOKING_CANCELLATION' && ctx.bookingId
    // Không xác định được đối tượng nguồn thì không đoán; thông báo vẫn gắn với payment.
    const target = forRental
      ? `đơn thuê thiết bị ${shortRef(ctx.rentalOrderId!)} đã huỷ`
      : forBooking
        ? `đặt chỗ chuyến đi ${shortRef(ctx.bookingId!)} đã huỷ`
        : 'giao dịch đã huỷ'
    const sandbox = ctx.simulated
    return [
      {
        semanticType: eventType,
        userId: ctx.userId,
        data: {
          notificationType: N.PAYMENT_REFUND,
          referenceType: forRental ? R.RENTAL_ORDER : forBooking ? R.BOOKING : R.PAYMENT,
          referenceId: forRental ? ctx.rentalOrderId! : forBooking ? ctx.bookingId! : ctx.refundId,
          title: `${sandbox ? '[Sandbox] ' : ''}Hoàn tiền thành công`,
          content:
            `TrekGo đã hoàn ${formatVnd(ctx.amount)} cho ${target}. Thời gian tiền về tài khoản tuỳ ngân hàng hoặc cổng thanh toán.` +
            (sandbox ? ' (Giao dịch mô phỏng, không có tiền thật.)' : ''),
          metadata: {
            refundId: ctx.refundId,
            purpose: ctx.purpose,
            amount: ctx.amount,
            ...(forRental ? { orderId: ctx.rentalOrderId } : {}),
            ...(forBooking ? { bookingId: ctx.bookingId } : {}),
            ...(sandbox ? { sandboxSimulated: true } : {}),
          },
        },
      },
    ]
  }
  throw new Error('UNSUPPORTED_PAYMENT_NOTIFICATION_EVENT')
}
