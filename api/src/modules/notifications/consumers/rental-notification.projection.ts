import { z } from 'zod'
import {
  CUSTODY_PRESERVED_REASONS,
  EARLY_RETURN_EVENT_STATUSES,
  EARLY_RETURN_EVENT_TYPE,
  GRADE_DOWNGRADE_SHORTAGE_REASON,
  GRADE_SHORTAGE_HANDOVER_DEADLINE_KIND,
  HANDOVER_SHORTAGE_EVENT_TYPE,
  HANDOVER_SHORTAGE_REASON,
  SYSTEM_FAULT_CANCELLATION_REASON,
} from '../../../shared/constants/rental-event-reasons.constant'
import type { Notification } from '../schemas/notification.schema'
import { NotificationType as N, ReferenceType as R } from '../schemas/notification.enums'
import { formatDateTimeVi, formatVnd, shortRef } from './notification-format'

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
  // Thêm sau migration backfill; event mới phát sau khi deploy nên không cần backfill.
  EARLY_RETURN_EVENT_TYPE,
  HANDOVER_SHORTAGE_EVENT_TYPE,
] as const

const handoverShortagePayloadSchema = z.object({
  handoverId: z.string(),
  units: z.array(z.object({ unitId: z.string(), assetCode: z.string(), productName: z.string().optional() })).min(1),
  refundAmount: z.number().int().nonnegative(),
  refundRef: z.string().optional(),
  refundCreated: z.boolean(),
})

/**
 * CUSTOMER = chủ đơn; STAFF = mọi ADMIN + STAFF_INVENTORY đang hoạt động (consumer tự tra);
 * USER = đúng một người (`recipientId`), vd shipper được gán thu hồi.
 */
export type RentalNotificationAudience = 'CUSTOMER' | 'STAFF' | 'USER'
export type RentalNotificationDelivery = {
  semanticType: string
  audience: RentalNotificationAudience
  recipientId?: string
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

const earlyReturnPayloadSchema = z.object({
  requestId: z.string(),
  status: z.enum(EARLY_RETURN_EVENT_STATUSES),
  slotAt: z.string(),
  reason: z.string().optional(),
  wasConfirmed: z.boolean().optional(),
  assigneeId: z.string().optional(),
  assigneeName: z.string().optional(),
  previousAssigneeId: z.string().optional(),
})

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
  const user = (
    recipientId: string,
    role: string,
    title: string,
    content: string,
    metadata: Record<string, unknown>,
  ): RentalNotificationDelivery => ({
    semanticType: `${eventType}:${role}`,
    audience: 'USER',
    recipientId,
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
          'Hoàn tiền cọc thiết bị',
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
    case HANDOVER_SHORTAGE_EVENT_TYPE: {
      const s = handoverShortagePayloadSchema.parse(raw)
      const names = s.units.map((unit) => unit.productName ?? unit.assetCode).join(', ')
      const codes = s.units.map((unit) => unit.assetCode).join(', ')
      // Chỉ là khoản hoàn đang xử lý; "đã hoàn" do REFUND_SUCCEEDED báo riêng.
      const money = s.refundCreated
        ? ` Khoản hoàn ${formatVnd(String(s.refundAmount))} (phí thuê và tiền cọc của ${s.units.length} thiết bị này) đang được xử lý về tài khoản thanh toán của bạn; TrekGo sẽ báo khi tiền về.`
        : ` TrekGo sẽ liên hệ để hoàn ${formatVnd(String(s.refundAmount))} (phí thuê và tiền cọc của ${s.units.length} thiết bị này) cho bạn.`
      return [
        customer(
          N.RENTAL_ACTION_REQUIRED,
          'Đơn thuê được giao thiếu thiết bị',
          `Đơn thuê ${ref} được bàn giao thiếu ${s.units.length} thiết bị: ${names}. Bạn không phải trả hay đặt cọc cho các thiết bị này.${money}`,
          {
            reason: HANDOVER_SHORTAGE_REASON,
            handoverId: s.handoverId,
            refundId: s.refundRef,
            refundAmount: s.refundAmount,
          },
        ),
        staff(
          'Thiếu thiết bị khi bàn giao',
          `Đơn thuê ${ref} bàn giao thiếu ${s.units.length} thiết bị (${codes}). Các món này đã chuyển sang bảo trì: kho cần tìm lại, rồi hoàn tất bảo trì để đưa về kệ hoặc ghi mất.` +
            (s.refundCreated ? '' : ' Chưa tạo được khoản hoàn tự động — Admin cần hoàn tay cho khách.'),
          { reason: HANDOVER_SHORTAGE_REASON, handoverId: s.handoverId, unitIds: s.units.map((unit) => unit.unitId) },
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
    case EARLY_RETURN_EVENT_TYPE: {
      const e = earlyReturnPayloadSchema.parse(raw ?? {})
      const when = formatDateTimeVi(e.slotAt)
      const meta = { requestId: e.requestId, earlyReturnStatus: e.status, slotAt: e.slotAt }
      switch (e.status) {
        case 'REQUESTED':
          return [
            staff(
              `Yêu cầu trả đồ sớm đơn ${ref}`,
              `Khách muốn trả đồ của đơn thuê ${ref} sớm, lúc ${when}. Hãy xác nhận hoặc từ chối lịch.`,
              meta,
            ),
          ]
        case 'CONFIRMED':
          return [
            customer(
              N.RENTAL_SCHEDULE_CHANGED,
              'Lịch trả đồ sớm đã được xác nhận',
              `TrekGo đã xác nhận lịch nhận lại đồ của đơn thuê ${ref} lúc ${when}` +
                (e.assigneeName ? `, nhân viên ${e.assigneeName} sẽ đến nhận.` : '.') +
                ' Phí thuê và tiền cọc vẫn xử lý như khi trả đúng hạn.',
              meta,
            ),
            ...(e.assigneeId
              ? [
                  user(
                    e.assigneeId,
                    'ASSIGNEE',
                    `Thu hồi sớm đơn ${ref}`,
                    `Bạn được giao thu hồi thiết bị của đơn thuê ${ref} lúc ${when} (khách trả sớm). Kiểm tra task thu hồi trong danh sách của bạn.`,
                    { ...meta, assigneeId: e.assigneeId },
                  ),
                ]
              : []),
            ...(e.previousAssigneeId && e.previousAssigneeId !== e.assigneeId
              ? [
                  user(
                    e.previousAssigneeId,
                    'PREVIOUS_ASSIGNEE',
                    `Đã chuyển task thu hồi đơn ${ref}`,
                    `Task thu hồi đơn thuê ${ref} đã được chuyển cho nhân viên khác theo lịch trả sớm lúc ${when}. Bạn không cần đi thu hồi đơn này.`,
                    meta,
                  ),
                ]
              : []),
          ]
        case 'REJECTED':
          return [
            customer(
              N.RENTAL_SCHEDULE_CHANGED,
              'Lịch trả đồ sớm chưa được chấp nhận',
              `TrekGo chưa thể nhận lại đồ của đơn thuê ${ref} lúc ${when}` +
                (e.reason ? `: ${e.reason}` : '.') +
                ' Bạn có thể chọn lịch khác hoặc trả đúng hạn.',
              { ...meta, reason: e.reason },
            ),
          ]
        case 'EXPIRED':
          return [
            customer(
              N.RENTAL_SCHEDULE_CHANGED,
              'Yêu cầu trả đồ sớm đã hết hạn',
              `Yêu cầu trả đồ sớm lúc ${when} của đơn thuê ${ref} chưa kịp được xác nhận nên đã hết hạn. Bạn có thể gửi lịch mới hoặc trả đúng hạn.`,
              meta,
            ),
          ]
        case 'CANCELLED':
          // Chỉ cần báo nhân viên khi lịch đã được xác nhận (đã có người chuẩn bị đi thu hồi).
          return e.wasConfirmed
            ? [
                staff(
                  `Khách huỷ lịch trả đồ sớm đơn ${ref}`,
                  `Khách đã huỷ lịch trả đồ sớm lúc ${when} của đơn thuê ${ref}. Việc thu hồi quay về lịch thường.`,
                  meta,
                ),
                ...(e.assigneeId
                  ? [
                      user(
                        e.assigneeId,
                        'ASSIGNEE',
                        `Khách huỷ lịch trả sớm đơn ${ref}`,
                        `Khách đã huỷ lịch trả đồ sớm lúc ${when} của đơn thuê ${ref}. Task thu hồi vẫn giao cho bạn nhưng quay về lịch thường; xem giờ mới trong task.`,
                        meta,
                      ),
                    ]
                  : []),
              ]
            : []
        case 'RECONFIRM_REQUIRED':
          return [
            customer(
              N.RENTAL_SCHEDULE_CHANGED,
              'Lịch trả đồ sớm cần xác nhận lại',
              `Lịch chuyến đi thay đổi nên lịch trả đồ sớm lúc ${when} của đơn thuê ${ref} cần TrekGo xác nhận lại. Bạn sẽ nhận thông báo khi có kết quả.`,
              meta,
            ),
            staff(
              `Xác nhận lại lịch trả đồ sớm đơn ${ref}`,
              `Chuyến đi đổi lịch nên lịch trả đồ sớm lúc ${when} của đơn thuê ${ref} cần được xác nhận lại hoặc từ chối.`,
              meta,
            ),
            ...(e.assigneeId
              ? [
                  user(
                    e.assigneeId,
                    'ASSIGNEE',
                    `Tạm dừng thu hồi sớm đơn ${ref}`,
                    `Chuyến đi đổi lịch nên lịch thu hồi sớm lúc ${when} của đơn thuê ${ref} không còn hiệu lực. Đừng đến theo giờ này; task quay về hạn trả mới cho tới khi kho xác nhận lại.`,
                    { ...meta, assigneeId: e.assigneeId },
                  ),
                ]
              : []),
          ]
        case 'REASSIGNED':
          return [
            customer(
              N.RENTAL_SCHEDULE_CHANGED,
              e.previousAssigneeId ? 'Đổi nhân viên nhận lại đồ' : 'Đã có nhân viên nhận lại đồ',
              `Lịch trả đồ sớm của đơn thuê ${ref} lúc ${when} giữ nguyên` +
                (e.assigneeName ? `; nhân viên ${e.assigneeName} sẽ đến nhận.` : '.'),
              meta,
            ),
            ...(e.assigneeId
              ? [
                  user(
                    e.assigneeId,
                    'ASSIGNEE',
                    `Thu hồi sớm đơn ${ref}`,
                    `Bạn được giao thu hồi thiết bị của đơn thuê ${ref} lúc ${when} (khách trả sớm). Kiểm tra task thu hồi trong danh sách của bạn.`,
                    { ...meta, assigneeId: e.assigneeId },
                  ),
                ]
              : []),
            ...(e.previousAssigneeId && e.previousAssigneeId !== e.assigneeId
              ? [
                  user(
                    e.previousAssigneeId,
                    'PREVIOUS_ASSIGNEE',
                    `Đã chuyển task thu hồi đơn ${ref}`,
                    `Task thu hồi đơn thuê ${ref} lúc ${when} đã được chuyển cho nhân viên khác. Bạn không cần đi thu hồi đơn này.`,
                    meta,
                  ),
                ]
              : []),
          ]
        case 'SLOT_MISSED':
          return [
            staff(
              `Lỡ hẹn thu hồi sớm đơn ${ref}`,
              `Đã quá giờ hẹn trả đồ sớm lúc ${when} của đơn thuê ${ref} mà chưa thu hồi. Liên hệ nhân viên giao nhận hoặc khách để xếp lại.`,
              meta,
            ),
            ...(e.assigneeId
              ? [
                  user(
                    e.assigneeId,
                    'ASSIGNEE',
                    `Chưa thu hồi đơn ${ref}`,
                    `Lịch thu hồi sớm lúc ${when} của đơn thuê ${ref} đã quá giờ mà chưa quét nhận đồ. Hãy liên hệ khách hoặc báo kho nếu không đi được.`,
                    { ...meta, assigneeId: e.assigneeId },
                  ),
                ]
              : []),
          ]
      }
      return []
    }
    default:
      throw new Error('UNSUPPORTED_RENTAL_NOTIFICATION_EVENT')
  }
}
