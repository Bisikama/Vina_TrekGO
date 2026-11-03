-- Additive consumer-owned receipts. Global outbox status belongs to other consumers.
CREATE TABLE "booking_notification_receipts" (
  "event_id" UUID NOT NULL REFERENCES "booking_outbox_events"("id") ON DELETE RESTRICT,
  "consumer" VARCHAR(100) NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" VARCHAR(100),
  PRIMARY KEY ("event_id", "consumer")
);
CREATE INDEX "booking_notification_retry_idx" ON "booking_notification_receipts" ("consumer", "completed_at", "next_attempt_at");
