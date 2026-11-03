-- Receipt theo từng consumer cho thông báo trong app từ rental_outbox_events và payment_outbox_events
-- (cùng dạng booking_notification_receipts). Additive: chỉ tạo bảng và chèn receipt, không sửa/xoá dữ liệu cũ.

CREATE TABLE "rental_notification_receipts" (
  "event_id" UUID NOT NULL,
  "consumer" VARCHAR(100) NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" VARCHAR(100),
  CONSTRAINT "rental_notification_receipts_pkey" PRIMARY KEY ("event_id", "consumer")
);
CREATE INDEX "rental_notification_retry_idx" ON "rental_notification_receipts" ("consumer", "completed_at", "next_attempt_at");
ALTER TABLE "rental_notification_receipts" ADD CONSTRAINT "rental_notification_receipts_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "rental_outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payment_notification_receipts" (
  "event_id" UUID NOT NULL,
  "consumer" VARCHAR(100) NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" VARCHAR(100),
  CONSTRAINT "payment_notification_receipts_pkey" PRIMARY KEY ("event_id", "consumer")
);
CREATE INDEX "payment_notification_retry_idx" ON "payment_notification_receipts" ("consumer", "completed_at", "next_attempt_at");
ALTER TABLE "payment_notification_receipts" ADD CONSTRAINT "payment_notification_receipts_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "payment_outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Không gửi dồn thông báo cho sự kiện đã có trước khi deploy: consumer mới chỉ xử lý sự kiện phát sinh sau migration.
-- Danh sách loại sự kiện phải khớp rentalNotificationEvents / paymentNotificationEvents / bookingNotificationEvents mới.
INSERT INTO "rental_notification_receipts" ("event_id", "consumer", "completed_at", "attempts", "last_error")
SELECT id, 'rental-notifications-v1', now(), 0, 'BACKFILLED_AT_MIGRATION'
FROM "rental_outbox_events"
WHERE event_type IN (
  'RENTAL_PAID', 'RENTAL_ORDER_CONFIRMED', 'DEPOSIT_REFUND_SUCCEEDED', 'DEPOSIT_RETAINED',
  'RENTAL_ORDER_CANCELLED', 'RENTAL_ACTION_REQUIRED', 'RENTAL_SCHEDULE_NOTICE_ISSUED'
)
ON CONFLICT ("event_id", "consumer") DO NOTHING;

INSERT INTO "payment_notification_receipts" ("event_id", "consumer", "completed_at", "attempts", "last_error")
SELECT id, 'payment-notifications-v1', now(), 0, 'BACKFILLED_AT_MIGRATION'
FROM "payment_outbox_events"
WHERE event_type IN ('PAYMENT_SUCCEEDED', 'REFUND_SUCCEEDED')
ON CONFLICT ("event_id", "consumer") DO NOTHING;

-- Loại sự kiện booking mới đưa vào thông báo (Trip riêng huỷ/đổi lịch).
INSERT INTO "booking_notification_receipts" ("event_id", "consumer", "completed_at", "attempts", "last_error")
SELECT id, 'booking-notifications-v1', now(), 0, 'BACKFILLED_AT_MIGRATION'
FROM "booking_outbox_events"
WHERE event_type IN ('PRIVATE_TRIP_CANCELLED', 'PRIVATE_TRIP_UPDATED')
ON CONFLICT ("event_id", "consumer") DO NOTHING;
