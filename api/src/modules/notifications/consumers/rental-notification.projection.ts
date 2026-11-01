import { z } from 'zod'
import {
  CUSTODY_PRESERVED_REASONS,
  GRADE_DOWNGRADE_SHORTAGE_REASON,
  GRADE_SHORTAGE_HANDOVER_DEADLINE_KIND,
  SYSTEM_FAULT_CANCELLATION_REASON,
} from '../../../shared/constants/rental-event-reasons.constant'
import type { Notification } from '../schemas/notification.schema'
import { NotificationType as N, ReferenceType as R } from '../schemas/notification.enums'
import { formatDateTimeVi, shortRef } from './notification-format'

export const RENTAL_NOTIFICATION_CONSUMER = 'rental-notifications-v1'

/** Phải khớp danh sách backfill trong migration 20261031090000_notification_receipts. */
export const rentalNotificationEvents = [
  'RENTAL_PAID',
  'RENTAL_ORDER_CONFIRMED',
  'DEPOSIT_REFUND_SUCCEEDED',
  'DEPOSIT_RETAINED',
  'RENTAL_ORDER_CANCELLED',
  'RENTAL_ACTION_REQUIRED',
  'RENTAL_SCHEDULE_NOTICE_ISSUED',
] as const

/** CUSTOMER = chủ đơn; STAFF = mọi ADMIN + STAFF_INVENTORY đang hoạt động (consumer tự tra). */
export type RentalNotificationAudience = 'CUSTOMER' | 'STAFF'
export type RentalNotificationDelivery = {
  semanticType: string
  audience: RentalNotificationAudience
  data: Omit<Partial<Notification>, 'userId'>
}
export type RentalNotificationContext = {
  orderId: string
  /** Refund trong payload là giao dịch mô phỏng sandbox (không có tiền thật). */
  refundSimulated?: boolean
  /** Ngưỡng giờ của nhắc nhở thiếu hàng (GRADE_SHORTAGE_ALERT_HOURS) để ghi vào nội dung. */
  shortageAlertHours?: number
}

const payloadSchema = z
  .object({
    reason: z.string().optional(),
    kind: z.string().optional(),
    cancellationSource: z.enum(['TRIP', 'BOOKING', 'MEMBERSHIP']).optional(),
    financialStatus: z.string().nullable().optional(),
    rentalEndAt: z.string().optional(),
    rentalStartAt: z.string().optional(),
    operationalReturnDueAt: z.string().nullable().optional(),
    feeChanged: z.boolean().optional(),
    paymentId: z.string().optional(),
    refundId: z.string().optional(),
    refundRef: z.string().optional(),
    reasonCode: z.string().optional(),
    itemId: z.string().optional(),
    gradeReviewId: z.string().optional(),
  })
  .passthrough()

const CUSTODY_PRESERVED_INTRO: Record<string, string> = {
  [CUSTODY_PRESERVED_REASONS.TRIP]: 'Chuyến đi của bạn đã bị huỷ.',
  [CUSTODY_PRESERVED_REASONS.BOOKING]: 'Đặt chỗ chuyến đi của bạn đã được huỷ.',
  [CUSTODY_PRESERVED_REASONS.MEMBERSHIP]: 'Bạn không còn là thành viên của chuyến đi.',
}

const CANCELLATION_INTRO: Record<string, (ref: string) => string> = {
  TRIP: (ref) => `Chuyến đi đã bị huỷ nên đơn thuê thiết bị ${ref} cũng được huỷ.`,
  BOOKING: (ref) => `Đặt chỗ chuyến đi đã được huỷ nên đơn thuê thiết bị ${ref} cũng được huỷ.`,
  MEMBERSHIP: (ref) => `Bạn không còn là thành viên chuyến đi nên đơn thuê thiết bị ${ref} đã được huỷ.`,
}

/** Chỉ mô tả trạng thái tiền mà event thật sự xác nhận; không bao giờ nói "đã hoàn" ở bước này. */
function cancellationMoneySentence(financialStatus: string | null | undefined): string {
  if (financialStatus === 'REFUND_PENDING')
    return ' Khoản hoàn tiền đang được xử lý; TrekGo sẽ báo cho bạn khi tiền đã được hoàn.'
  if (financialStatus === 'UNPAID') return ' Đơn chưa được thanh toán nên bạn không bị trừ tiền.'
  if (financialStatus === 'PAID') return ' TrekGo đang kiểm tra khoản hoàn tiền cho đơn này.'
  return ''
}

/**
 * Hàm thuần: rental outbox event → danh sách thông báo. Trả [] cho event không cần báo ai
 * (consumer vẫn ghi receipt hoàn tất). Ném lỗi khi payload hỏng để consumer retry/giữ lại.
 */
export function rentalNotificationProjection(
  eventType: string,
  raw: unknown,
  ctx: RentalNotificationContext,
): RentalNotificationDelivery[] {
  const p = payloadSchema.parse(raw ?? {})
  const ref = shortRef(ctx.orderId)
  const base = { referenceType: R.RENTAL_ORDER, referenceId: ctx.orderId }
  const customer = (
    notificationType: N,
    title: string,
    content: string,
    metadata: Record<string, unknown> = {},
  ): RentalNotificationDelivery => ({
    semanticType: eventType,
    audience: 'CUSTOMER',
    data: {
      ...base,
      notificationType,
      title,
      content,
      metadata: { schemaVersion: 1, orderId: ctx.orderId, ...metadata },
    },
  })
  const staff = (title: string, content: string, metadata: Record<string, unknown>): RentalNotificationDelivery => ({
    semanticType: `${eventType}:STAFF`,
    audience: 'STAFF',
    data: {
      ...base,
      notificationType: N.RENTAL_STAFF_ACTION_REQUIRED,
      title,
      content,
      metadata: { schemaVersion: 1, orderId: ctx.orderId, ...metadata },
    },
  })

  switch (eventType) {
    case 'RENTAL_PAID':
    case 'RENTAL_ORDER_CONFIRMED':
      return [
        customer(
          N.RENTAL_ORDER_CONFIRMED,
          'Xác nhận đơn thuê thiết bị',
          `Đơn thuê thiết bị ${ref} đã được thanh toán thành công và đang được chuẩn bị.`,
          { paymentId: p.paymentId },
        ),
      ]
    case 'DEPOSIT_REFUND_SUCCEEDED': {
      const sandbox = ctx.refundSimulated === true
      return [
        customer(
          N.RENTAL_DEPOSIT_REFUNDED,
          `${sandbox ? '[Sandbox] ' : ''}Hoàn tiền cọc thiết bị`,
          `Tiền đặt cọc cho đơn thuê ${ref} đã được hoàn về tài khoản thanh toán của bạn.` +
            (sandbox ? ' (Giao dịch mô phỏng, không có tiền thật.)' : ''),
          { refundId: p.refundId, ...(sandbox ? { sandboxSimulated: true } : {}) },
        ),
      ]
    }
    case 'DEPOSIT_RETAINED':
      return [
        customer(
          N.RENTAL_DAMAGE_REPORTED,
          'Thông báo xử lý tiền cọc',
          `Đơn thuê ${ref} có khoản cọc được khấu trừ/giữ lại theo biên bản kiểm tra thiết bị.`,
          { itemId: p.itemId },
        ),
      ]
    case 'RENTAL_ORDER_CANCELLED': {
      if (p.reason === SYSTEM_FAULT_CANCELLATION_REASON) {
        return [
          customer(
            N.RENTAL_ORDER_CANCELLED,
            'Đơn thuê thiết bị đã bị huỷ',
            `Rất tiếc, TrekGo không thể chuẩn bị đủ thiết bị cho đơn thuê ${ref} nên đã huỷ đơn. Toàn bộ tiền thuê và tiền cọc sẽ được hoàn về tài khoản thanh toán của bạn; TrekGo sẽ báo khi tiền đã được hoàn.`,
            { refundId: p.refundRef, reasonCode: p.reasonCode },
          ),
        ]
      }
      const intro = p.cancellationSource
        ? CANCELLATION_INTRO[p.cancellationSource](ref)
        : `Đơn thuê thiết bị ${ref} đã được huỷ.`
      return [
        customer(
          N.RENTAL_ORDER_CANCELLED,
          'Đơn thuê thiết bị đã bị huỷ',
          intro + cancellationMoneySentence(p.financialStatus),
          {
            cancellationSource: p.cancellationSource ?? null,
            financialStatus: p.financialStatus ?? null,
          },
        ),
      ]
    }
    case 'RENTAL_ACTION_REQUIRED': {
      const custodyIntro = p.reason ? CUSTODY_PRESERVED_INTRO[p.reason] : undefined
      if (custodyIntro) {
        const due = p.rentalEndAt ? ` Hạn trả theo hợp đồng vẫn là ${formatDateTimeVi(p.rentalEndAt)}.` : ''
        return [
          customer(
            N.RENTAL_ACTION_REQUIRED,
            'Đơn thuê thiết bị cần lưu ý',
            `${custodyIntro} Đơn thuê ${ref} vẫn còn hiệu lực vì bạn đang giữ thiết bị.${due} Nhân viên TrekGo sẽ liên hệ để hướng dẫn trả thiết bị.`,
            { reason: p.reason },
          ),
        ]
      }
      if (p.reason === GRADE_DOWNGRADE_SHORTAGE_REASON) {
        return [
          staff(
            `Đơn thuê ${ref} có nguy cơ thiếu thiết bị`,
            `Một thiết bị vừa bị hạ hạng nên đơn thuê ${ref} có thể thiếu thiết bị đúng hạng. Hãy tìm thiết bị thay thế; nếu không thể, ADMIN huỷ đơn do lỗi hệ thống để hoàn tiền cho khách.`,
            { reason: p.reason, gradeReviewId: p.gradeReviewId },
          ),
        ]
      }
      if (p.kind === GRADE_SHORTAGE_HANDOVER_DEADLINE_KIND) {
        const when = p.rentalStartAt ? ` (nhận đồ lúc ${formatDateTimeVi(p.rentalStartAt)})` : ''
        const window = ctx.shortageAlertHours ? `còn dưới ${ctx.shortageAlertHours} giờ` : 'sắp'
        return [
          staff(
            `Đơn thuê ${ref} sắp tới giờ nhận, cần kiểm tra thiết bị`,
            // Đơn còn ACTION_REQUIRED không chắc là vì thiếu hàng (có thể vì lý do khác), nên chỉ nhắc kiểm tra.
            `Đơn thuê ${ref} từng thiếu thiết bị đúng hạng do hạ hạng, vẫn đang cần xử lý và ${window} tới giờ nhận đồ${when}. Hãy kiểm tra: nếu đã có thiết bị thay thế thì chuẩn bị giao như thường; nếu không, ADMIN huỷ đơn do lỗi hệ thống.`,
            { kind: p.kind, gradeReviewId: p.gradeReviewId },
          ),
        ]
      }
      return []
    }
    case 'RENTAL_SCHEDULE_NOTICE_ISSUED': {
      if (!p.operationalReturnDueAt) throw new Error('RENTAL_SCHEDULE_NOTICE_INVALID')
      return [
        customer(
          N.RENTAL_SCHEDULE_CHANGED,
          'Hạn trả thiết bị đã thay đổi',
          `Lịch chuyến đi thay đổi nên hạn trả thiết bị của đơn thuê ${ref} đổi thành ${formatDateTimeVi(p.operationalReturnDueAt)}.` +
            (p.feeChanged === false ? ' Phí thuê không thay đổi.' : ''),
          { operationalReturnDueAt: p.operationalReturnDueAt },
        ),
      ]
    }
    default:
      throw new Error('UNSUPPORTED_RENTAL_NOTIFICATION_EVENT')
  }
}
