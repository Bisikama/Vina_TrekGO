import { z } from 'zod'
import { Notification, NotificationType as N, ReferenceType as R } from '../schemas/notification.schema'
export const bookingNotificationEvents = [
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'PRIVATE_TRIP_MEMBER_JOINED',
  'PRIVATE_TRIP_MEMBER_INVITED',
  'PUBLIC_PARTICIPANT_INVITED',
  'PUBLIC_PARTICIPANT_CLAIMED',
]
type Delivery = { semanticType: string; data: Partial<Notification> & { userId: string } }
const uuid = z.string().uuid()
export function bookingNotificationProjection(eventType: string, raw: unknown): Delivery[] {
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
  if (eventType === 'BOOKING_CONFIRMED' || eventType === 'BOOKING_CANCELLED') {
    const p = z
      .object({ userId: uuid, bookingId: uuid, confirmedAt: z.string().optional(), cancellationId: uuid.optional() })
      .parse(raw)
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
