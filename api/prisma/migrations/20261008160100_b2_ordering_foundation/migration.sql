-- B2 foundation for RB-API-201.
-- This is an additive internal schema extension: B1 public API/behavior stays unchanged.

-- 1) Versioned payment hold TTL.
ALTER TABLE "rental_policies"
ADD COLUMN "payment_hold_minutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN "free_cancellation_hours" INTEGER NOT NULL DEFAULT 24;

-- 2) Persist the exact occupied window calculated by B1 at quote time.
ALTER TABLE "rental_quotes"
ADD COLUMN "occupied_start_at" TIMESTAMPTZ(6),
ADD COLUMN "occupied_end_at" TIMESTAMPTZ(6);

-- Existing pre-B2 quotes are backfilled only to satisfy NOT NULL. New quotes use the
-- exact B1 occupied window (pickup/return schedule + policy buffers).
UPDATE "rental_quotes" q
SET
  "occupied_start_at" = q."rental_start_at" - make_interval(mins => p."prep_buffer_minutes"),
  "occupied_end_at" = q."rental_end_at" + make_interval(mins => p."return_buffer_minutes" + p."cleaning_buffer_minutes")
FROM "rental_policies" p
WHERE p."id" = q."rental_policy_id";

ALTER TABLE "rental_quotes"
ALTER COLUMN "occupied_start_at" SET NOT NULL,
ALTER COLUMN "occupied_end_at" SET NOT NULL;

-- 3) Freeze replacement value together with the Quote so RentalOrderLine does not
-- read a newer catalog value between quote and create-order.
ALTER TABLE "rental_quote_lines"
ADD COLUMN "replacement_value_snapshot" DECIMAL(12,2);

UPDATE "rental_quote_lines" ql
SET "replacement_value_snapshot" = p."replacement_value"
FROM "rental_products" p
WHERE p."id" = ql."product_id";

ALTER TABLE "rental_quote_lines"
ALTER COLUMN "replacement_value_snapshot" SET NOT NULL;

-- 4) Generic HTTP idempotency cache for B2 mutations.
CREATE TABLE "idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" VARCHAR(120) NOT NULL,
  "user_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "response_status" INTEGER,
  "response_body" JSONB,
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_scope_user_id_idempotency_key_key"
ON "idempotency_records" ("scope", "user_id", "idempotency_key");

CREATE INDEX "idempotency_records_created_at_idx"
ON "idempotency_records" ("created_at");

-- 5) Absolute DB guard: one unfinished RentalOrder per Booking.
-- If this fails, existing data already contains duplicate open orders and must be
-- reconciled before the migration is applied.
CREATE UNIQUE INDEX "uq_rental_order_booking_open"
ON "rental_orders" ("booking_id")
WHERE "status" IN (
  'PENDING_PAYMENT',
  'PAID',
  'PREPARING',
  'READY_FOR_HANDOVER',
  'ACTIVE',
  'RETURN_PENDING',
  'RETURN_PROCESSING'
);
