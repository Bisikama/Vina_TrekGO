-- Bổ sung cho 20261031090000_notification_receipts (không sửa migration đã áp).

-- 1. Consumer thông báo quét payment_outbox_events theo event_type, thứ tự created_at mỗi 3 giây.
CREATE INDEX "payment_outbox_events_event_type_created_at_idx" ON "payment_outbox_events" ("event_type", "created_at");

-- 2. Thu hẹp backfill: chỉ coi là "đã xử lý" các event cũ hơn 1 giờ so với lúc backfill.
--    Event phát sinh ngay trước deploy vẫn được gửi. Event consumer cũ đã báo rồi không bị gửi lại
--    (NotificationsService.deliverEvent bỏ qua thông báo cũ có cùng metadata.outboxEventId + userId).
--    Chỉ xoá receipt do chính migration trước chèn (last_error = 'BACKFILLED_AT_MIGRATION'); không đụng dữ liệu khác.
DELETE FROM "rental_notification_receipts" r
USING "rental_outbox_events" e
WHERE r.event_id = e.id
  AND r.last_error = 'BACKFILLED_AT_MIGRATION'
  AND e.created_at > r.completed_at - interval '1 hour';

DELETE FROM "payment_notification_receipts" r
USING "payment_outbox_events" e
WHERE r.event_id = e.id
  AND r.last_error = 'BACKFILLED_AT_MIGRATION'
  AND e.created_at > r.completed_at - interval '1 hour';

DELETE FROM "booking_notification_receipts" r
USING "booking_outbox_events" e
WHERE r.event_id = e.id
  AND r.consumer = 'booking-notifications-v1'
  AND r.last_error = 'BACKFILLED_AT_MIGRATION'
  AND e.created_at > r.completed_at - interval '1 hour';
