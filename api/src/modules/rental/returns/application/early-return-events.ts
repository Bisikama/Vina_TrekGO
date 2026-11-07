import { Prisma } from '@prisma/client'
import {
  EARLY_RETURN_EVENT_TYPE,
  type EarlyReturnEventStatus,
} from 'src/shared/constants/rental-event-reasons.constant'

/** Ghi outbox trong cùng transaction với thay đổi trạng thái; notifications đọc để báo khách/nhân viên. */
export async function emitEarlyReturnEventTx(
  tx: Prisma.TransactionClient,
  input: {
    requestId: string
    orderId: string
    status: EarlyReturnEventStatus
    /** version của yêu cầu sau thay đổi; giữ khoá chống trùng duy nhất cho từng lần đổi trạng thái. */
    version: number
    slotAt: Date
    reason?: string | null
    wasConfirmed?: boolean
  },
) {
  const deduplicationKey = `rental-early-return:${input.requestId}:${input.status}:${input.version}`
  await tx.rentalOutboxEvent.upsert({
    where: { deduplicationKey },
    update: {},
    create: {
      deduplicationKey,
      eventType: EARLY_RETURN_EVENT_TYPE,
      aggregateType: 'RentalOrder',
      aggregateId: input.orderId,
      payload: {
        orderId: input.orderId,
        requestId: input.requestId,
        status: input.status,
        slotAt: input.slotAt.toISOString(),
        // notifications đọc `reason` là string tuỳ chọn; null sẽ làm parse lỗi.
        ...(input.reason ? { reason: input.reason } : {}),
        wasConfirmed: input.wasConfirmed ?? false,
      },
    },
  })
}
