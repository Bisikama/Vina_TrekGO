import { Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../shared/services/prisma.service'

/** Nguồn outbox + bảng receipt tương ứng. Tên bảng là hằng trong code, không bao giờ lấy từ input. */
export const NOTIFICATION_OUTBOX_SOURCES = {
  rental: { outboxTable: 'rental_outbox_events', receiptTable: 'rental_notification_receipts' },
  payment: { outboxTable: 'payment_outbox_events', receiptTable: 'payment_notification_receipts' },
} as const
export type NotificationOutboxSource = (typeof NOTIFICATION_OUTBOX_SOURCES)[keyof typeof NOTIFICATION_OUTBOX_SOURCES]

export type NotificationOutboxEvent = {
  id: string
  eventType: string
  aggregateType: string
  aggregateId: string
  payload: unknown
}

const BATCH_SIZE = 25
const MAX_BATCHES_PER_TICK = 4
/** Sau số lần lỗi này chuyển sang thử thưa (mỗi giờ) thay vì dừng: sự cố hạ tầng kéo dài vẫn tự phục hồi. */
export const SLOW_RETRY_AFTER_ATTEMPTS = 20
export const SLOW_RETRY_INTERVAL_MINUTES = 60
/** Event cũ hơn số ngày này không gửi nữa (thông báo đã quá cũ, kể cả event dữ liệu hỏng đang thử thưa). */
export const NOTIFICATION_MAX_AGE_DAYS = 3

/**
 * Quét outbox theo thứ tự cũ → mới, bỏ qua event đã có receipt hoàn tất hoặc đang chờ backoff.
 * Không phụ thuộc `status` của outbox (status thuộc pipeline của module khác).
 * Một event lỗi không chặn event khác; retry với backoff 3s × 2^n (tối đa 300s), sau
 * SLOW_RETRY_AFTER_ATTEMPTS lần thì mỗi giờ một lần, cho tới khi event cũ hơn NOTIFICATION_MAX_AGE_DAYS ngày.
 * `deliver` phải an toàn khi gọi lại (Mongo insert có thể thành công trước khi ghi receipt).
 */
export async function drainNotificationOutbox(input: {
  db: PrismaService
  source: NotificationOutboxSource
  consumer: string
  eventTypes: readonly string[]
  deliver: (event: NotificationOutboxEvent) => Promise<void>
  logger: Logger
}): Promise<number> {
  const { db, source, consumer, eventTypes, deliver, logger } = input
  const outbox = Prisma.raw(`"${source.outboxTable}"`)
  const receipts = Prisma.raw(`"${source.receiptTable}"`)
  let processed = 0
  for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
    const events = await db.$queryRaw<NotificationOutboxEvent[]>(Prisma.sql`
      SELECT e.id, e.event_type AS "eventType", e.aggregate_type AS "aggregateType",
             e.aggregate_id AS "aggregateId", e.payload
      FROM ${outbox} e
      LEFT JOIN ${receipts} r ON r.event_id = e.id AND r.consumer = ${consumer}
      WHERE e.event_type IN (${Prisma.join([...eventTypes])})
        AND r.completed_at IS NULL
        AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= now())
        AND e.created_at > now() - make_interval(days => ${NOTIFICATION_MAX_AGE_DAYS}::int)
      ORDER BY e.created_at ASC, e.id ASC
      LIMIT ${BATCH_SIZE}
    `)
    if (!events.length) break
    for (const event of events) {
      try {
        await deliver(event)
        await db.$executeRaw(Prisma.sql`
          INSERT INTO ${receipts} (event_id, consumer, completed_at, attempts)
          VALUES (${event.id}::uuid, ${consumer}, now(), 1)
          ON CONFLICT (event_id, consumer) DO UPDATE SET completed_at = now(), last_error = NULL,
            attempts = ${receipts}.attempts + 1
          WHERE ${receipts}.completed_at IS NULL`)
        processed++
      } catch (error) {
        // Không log payload hay lỗi driver (có thể chứa dữ liệu cá nhân); chỉ mã lỗi ngắn.
        const code =
          error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message) ? error.message : 'DELIVERY_FAILED'
        await db.$executeRaw(Prisma.sql`
          INSERT INTO ${receipts} (event_id, consumer, attempts, next_attempt_at, last_error)
          VALUES (${event.id}::uuid, ${consumer}, 1, now() + interval '3 seconds', ${code})
          ON CONFLICT (event_id, consumer) DO UPDATE SET
            attempts = ${receipts}.attempts + 1,
            next_attempt_at = now() + CASE
              WHEN ${receipts}.attempts + 1 >= ${SLOW_RETRY_AFTER_ATTEMPTS}
                THEN make_interval(mins => ${SLOW_RETRY_INTERVAL_MINUTES}::int)
              ELSE interval '1 second' * LEAST(300, 3 * power(2, LEAST(7, ${receipts}.attempts)))
            END,
            last_error = ${code}
          WHERE ${receipts}.completed_at IS NULL`)
        logger.warn(`Notification delivery pending retry: ${consumer} ${event.id} ${code}`)
      }
    }
    if (events.length < BATCH_SIZE) break
  }
  return processed
}
