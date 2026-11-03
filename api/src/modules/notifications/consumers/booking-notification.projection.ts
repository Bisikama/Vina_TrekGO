import { z } from 'zod'
import type { Notification } from '../schemas/notification.schema'
import { NotificationType as N, ReferenceType as R } from '../schemas/notification.enums'
import { formatDateTimeVi } from './notification-format'
export const bookingNotificationEvents = [
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'PRIVATE_TRIP_MEMBER_JOINED',
  'PRIVATE_TRIP_MEMBER_INVITED',
  'PUBLIC_PARTICIPANT_INVITED',
  'PUBLIC_PARTICIPANT_CLAIMED',
  'PRIVATE_TRIP_CANCELLED',
  'PRIVATE_TRIP_UPDATED',
]
/**
 * Người nhận phụ do consumer tra trong DB (projection vẫn là hàm thuần):
 * - `participantUserIds`: người đã nhận vé của booking (khác người mua), cho BOOKING_CANCELLED khi chuyến bị huỷ.
 * - `memberUserIds`: thành viên đang hoạt động của Trip riêng (trừ người tạo), cho PRIVATE_TRIP_*.
 */
export type BookingNotificationContext = { participantUserIds?: string[]; memberUserIds?: string[] }
/** Booking bị huỷ không phải do chính khách: cần báo cả người đã nhận vé. */
export function bookingCancelledByOthers(raw: unknown): boolean {
  const source = (raw as { cancelSource?: unknown } | null)?.cancelSource
  return source === 'ORGANIZER' || source === 'ADMIN'
}
type Delivery = { semanticType: string; data: Partial<Notification> & { userId: string } }
const uuid = z.string().uuid()
export function bookingNotificationProjection(
  eventType: string,
  raw: unknown,
  ctx: BookingNotificationContext = {},
): Delivery[] {
  const common = z.object({ tripId: uuid }).passthrough().parse(raw)
  const base = { referenceType: R.TRIP, referenceId: common.tripId }
  const delivery = (userId: string, notificationType: N, title: string, target: Record<string, string>): Delivery => ({
    semanticType: eventType,
    data: {
      ...base,
      userId,
      notificationType,
      title,
      content: title,
      metadata: { schemaVersion: 1, tripId: common.tripId, target },
    },
  })
  if (eventType === 'PRIVATE_TRIP_MEMBER_INVITED' || eventType === 'PUBLIC_PARTICIPANT_INVITED') {
    const p = z.object({ invitationId: uuid, recipientUserId: uuid }).parse(raw)
    const type = eventType === 'PUBLIC_PARTICIPANT_INVITED' ? 'PUBLIC' : 'PRIVATE'
    return [
      delivery(
        p.recipientUserId,
        type === 'PUBLIC' ? N.PUBLIC_PARTICIPANT_INVITE : N.PRIVATE_TRIP_INVITE,
        type === 'PUBLIC' ? 'Bạn nhận được lời mời nhận vé chuyến đi' : 'Bạn nhận được lời mời tham gia chuyến riêng',
        { kind: 'INVITATION', type, invitationId: p.invitationId },
      ),
    ]
  }
  if (eventType === 'PUBLIC_PARTICIPANT_CLAIMED') {
    const p = z.object({ buyerUserId: uuid, recipientUserId: uuid, participantId: uuid, bookingId: uuid }).parse(raw)
    return [...new Set([p.recipientUserId, p.buyerUserId])].map((userId) =>
      delivery(
        userId,
        N.PUBLIC_PARTICIPANT_CLAIMED,
        'Vé chuyến đi đã được liên kết thành công',
        userId === p.recipientUserId
          ? { kind: 'TICKET', participantId: p.participantId }
          : { kind: 'BOOKING_PARTICIPANT', bookingId: p.bookingId, participantId: p.participantId },
      ),
    )
  }
  if (eventType === 'PRIVATE_TRIP_MEMBER_JOINED') {
    const p = z.object({ userId: uuid, memberRole: z.enum(['HOST', 'MEMBER']).optional() }).parse(raw)
    const result = delivery(p.userId, N.PRIVATE_TRIP_MEMBER_JOINED, 'Gia nhập chuyến đi thành công', {
      kind: 'PRIVATE_TRIP',
      tripId: common.tripId,
    })
    result.data.content = 'Bạn đã tham gia thành công vào chuyến đi riêng (Private Trip).'
    if (p.memberRole) result.data.metadata!.memberRole = p.memberRole
    return [result]
  }
  if (eventType === 'PRIVATE_TRIP_CANCELLED' || eventType === 'PRIVATE_TRIP_UPDATED') {
    const window = z.object({ startAt: z.string(), endAt: z.string() })
    const p = z
      .object({
        creatorId: uuid.optional(),
        oldWindow: window.optional(),
        newWindow: window.optional(),
        reason: z.string().nullable().optional(),
      })
      .parse(raw)
    const recipients = [...new Set(ctx.memberUserIds ?? [])].filter((id) => id !== p.creatorId)
    if (eventType === 'PRIVATE_TRIP_UPDATED') {
      // Chỉ báo khi lịch đổi; sửa thông tin khác không làm phiền thành viên.
      if (!p.oldWindow || !p.newWindow) return []
      const changed =
        +new Date(p.oldWindow.startAt) !== +new Date(p.newWindow.startAt) ||
        +new Date(p.oldWindow.endAt) !== +new Date(p.newWindow.endAt)
      if (!changed) return []
      const content = `Chuyến đi riêng bạn tham gia đã đổi lịch: ${formatDateTimeVi(p.newWindow.startAt)} – ${formatDateTimeVi(p.newWindow.endAt)}.`
      return recipients.map((userId) => {
        const result = delivery(userId, N.TRIP_SCHEDULE_CHANGED, 'Lịch chuyến đi đã thay đổi', {
          kind: 'PRIVATE_TRIP',
          tripId: common.tripId,
        })
        result.data.content = content
        result.data.metadata!.newWindow = p.newWindow
        return result
      })
    }
    const reason = p.reason?.trim() ? ` Lý do: ${p.reason.trim().slice(0, 200)}` : ''
    return recipients.map((userId) => {
      const result = delivery(userId, N.TRIP_CANCELLED, 'Chuyến đi riêng đã bị huỷ', {
        kind: 'PRIVATE_TRIP',
        tripId: common.tripId,
      })
      result.data.content = `Người tổ chức đã huỷ chuyến đi riêng bạn tham gia.${reason}`
      return result
    })
  }
  if (eventType === 'BOOKING_CONFIRMED' || eventType === 'BOOKING_CANCELLED') {
    const p = z
      .object({
        userId: uuid,
        bookingId: uuid,
        confirmedAt: z.string().optional(),
        cancellationId: uuid.optional(),
        cancelSource: z.enum(['USER', 'ORGANIZER', 'ADMIN']).optional(),
      })
      .parse(raw)
    if (eventType === 'BOOKING_CANCELLED' && (p.cancelSource === 'ORGANIZER' || p.cancelSource === 'ADMIN')) {
      // Khách không tự huỷ: nói rõ ai huỷ; tiền chỉ "đang xử lý", kết quả hoàn báo riêng khi provider xác nhận.
      const byOrganizer = p.cancelSource === 'ORGANIZER'
      const buyer = delivery(
        p.userId,
        byOrganizer ? N.TRIP_CANCELLED : N.BOOKING_CANCELLED,
        byOrganizer ? 'Chuyến đi đã bị huỷ' : 'Đặt chỗ của bạn đã bị huỷ',
        { kind: 'BOOKING', bookingId: p.bookingId },
      )
      buyer.data.referenceType = R.BOOKING
      buyer.data.referenceId = p.bookingId
      buyer.data.content = byOrganizer
        ? 'Đơn vị tổ chức đã huỷ chuyến đi nên đặt chỗ của bạn được huỷ. Khoản hoàn tiền (nếu có) đang được xử lý; bạn sẽ nhận thông báo khi tiền đã được hoàn.'
        : 'TrekGo đã huỷ đặt chỗ chuyến đi của bạn. Khoản hoàn tiền (nếu có) đang được xử lý; bạn sẽ nhận thông báo khi tiền đã được hoàn.'
      buyer.data.metadata!.cancelSource = p.cancelSource
      if (p.cancellationId) buyer.data.metadata!.cancellationId = p.cancellationId
      // Người đã nhận vé chỉ cần biết vé bị huỷ; không gửi thông tin tiền của người mua.
      const holders = [...new Set(ctx.participantUserIds ?? [])]
        .filter((id) => id !== p.userId)
        .map((userId) => {
          const result = delivery(
            userId,
            byOrganizer ? N.TRIP_CANCELLED : N.BOOKING_CANCELLED,
            byOrganizer ? 'Chuyến đi đã bị huỷ' : 'Vé chuyến đi đã bị huỷ',
            { kind: 'TICKET_CANCELLED', tripId: common.tripId },
          )
          result.data.content = byOrganizer
            ? 'Đơn vị tổ chức đã huỷ chuyến đi nên vé của bạn không còn hiệu lực.'
            : 'Vé chuyến đi của bạn đã bị huỷ.'
          return result
        })
      return [buyer, ...holders]
    }
    const result = delivery(
      p.userId,
      eventType === 'BOOKING_CONFIRMED' ? N.BOOKING_CONFIRMED : N.BOOKING_CANCELLED,
      eventType === 'BOOKING_CONFIRMED' ? 'Đặt chỗ thành công!' : 'Hủy đặt chỗ thành công',
      { kind: 'BOOKING', bookingId: p.bookingId },
    )
    result.data.referenceType = R.BOOKING
    result.data.referenceId = p.bookingId
    result.data.content =
      eventType === 'BOOKING_CONFIRMED'
        ? 'Chuyến trekking của bạn đã được xác nhận thành công. Chúc bạn có một hành trình an toàn và đáng nhớ!'
        : 'Chuyến đi của bạn đã được hủy. Mọi thủ tục hoàn cọc/tiền (nếu có) đang được hệ thống xử lý.'
    if (p.confirmedAt) result.data.metadata!.confirmedAt = p.confirmedAt
    if (p.cancellationId) result.data.metadata!.cancellationId = p.cancellationId
    return [result]
  }
  throw new Error('Unsupported booking notification event')
}
