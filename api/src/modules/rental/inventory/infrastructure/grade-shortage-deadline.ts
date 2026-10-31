import { EventStatus, Prisma } from '@prisma/client'
import {
  GRADE_DOWNGRADE_SHORTAGE_REASON,
  GRADE_SHORTAGE_HANDOVER_DEADLINE_KIND,
} from '../../../../shared/constants/rental-event-reasons.constant'

type DeadlineCandidate = { orderId: string; tripId: string; rentalStartAt: Date; gradeReviewId: string }

/**
 * Nhắc staff khi đơn vẫn thiếu hàng do hạ hạng và sắp tới giờ nhận đồ: đơn chưa bàn giao, còn ACTION_REQUIRED,
 * có sự kiện thiếu hàng do hạ hạng, và `rentalStartAt − alertHours ≤ now`. Chỉ ghi outbox (không đổi đơn);
 * khoá dedup theo lần hạ hạng gần nhất nên mỗi lần thiếu hàng chỉ nhắc một lần. Khách chưa được báo ở bước này.
 */
export async function emitGradeShortageDeadlineAlerts(
  db: Pick<Prisma.TransactionClient, '$queryRaw' | 'rentalOutboxEvent'>,
  input: { now: Date; alertHours: number; limit?: number },
): Promise<string[]> {
  const candidates = await db.$queryRaw<DeadlineCandidate[]>`
    SELECT o.id AS "orderId", o.trip_id AS "tripId", o.rental_start_at AS "rentalStartAt", s.review_id AS "gradeReviewId"
    FROM rental_orders o
    JOIN LATERAL (
      SELECT e.payload->>'gradeReviewId' AS review_id
      FROM rental_outbox_events e
      WHERE e.aggregate_id = o.id
        AND e.event_type = 'RENTAL_ACTION_REQUIRED'
        AND e.payload->>'reason' = ${GRADE_DOWNGRADE_SHORTAGE_REASON}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT 1
    ) s ON s.review_id IS NOT NULL
    WHERE o.exception_status::text = 'ACTION_REQUIRED'
      AND o.status::text IN ('PAID', 'PREPARING', 'READY_FOR_HANDOVER')
      AND o.rental_start_at <= ${input.now}::timestamptz + make_interval(hours => ${input.alertHours}::int)
      AND NOT EXISTS (
        SELECT 1 FROM rental_outbox_events d
        WHERE d.deduplication_key = 'grade-shortage-deadline:' || o.id::text || ':' || s.review_id
      )
    ORDER BY o.rental_start_at ASC, o.id ASC
    LIMIT ${input.limit ?? 100}
  `
  for (const c of candidates) {
    const deduplicationKey = `grade-shortage-deadline:${c.orderId}:${c.gradeReviewId}`
    await db.rentalOutboxEvent.upsert({
      where: { deduplicationKey },
      update: {},
      create: {
        deduplicationKey,
        eventType: 'RENTAL_ACTION_REQUIRED',
        aggregateType: 'RentalOrder',
        aggregateId: c.orderId,
        status: EventStatus.PENDING,
        payload: {
          orderId: c.orderId,
          tripId: c.tripId,
          kind: GRADE_SHORTAGE_HANDOVER_DEADLINE_KIND,
          gradeReviewId: c.gradeReviewId,
          rentalStartAt: c.rentalStartAt.toISOString(),
          alertHours: input.alertHours,
        },
      },
    })
  }
  return candidates.map((c) => c.orderId)
}
