-- Migration v1.2: run AFTER existing B1-B6/Closure migrations. Back up the DB first.
-- Historical booking_id values are preserved for provenance; future Rental auth uses trip membership.
ALTER TABLE "rental_quotes" ALTER COLUMN "booking_id" DROP NOT NULL;
ALTER TABLE "rental_orders" ALTER COLUMN "booking_id" DROP NOT NULL;
ALTER TABLE "rental_quotes"
 ADD COLUMN "membership_ref" UUID, ADD COLUMN "membership_snapshot" JSONB,
 ADD COLUMN "pickup_point_id" UUID, ADD COLUMN "return_point_id" UUID,
 ADD COLUMN "return_option_snapshot" JSONB, ADD COLUMN "recipient_user_id" UUID;
ALTER TABLE "rental_orders"
 ADD COLUMN "membership_ref" UUID, ADD COLUMN "membership_snapshot" JSONB,
 ADD COLUMN "return_option_snapshot" JSONB, ADD COLUMN "recipient_user_id" UUID;
ALTER TABLE "rental_policies"
 ADD COLUMN "max_rental_after_trip_hours" INTEGER,
 ADD COLUMN "extension_request_cutoff_minutes" INTEGER,
 ADD COLUMN "extension_hold_minutes" INTEGER;
ALTER TABLE "rental_policies" ADD CONSTRAINT "rental_extension_config_nonnegative" CHECK
 (("max_rental_after_trip_hours" IS NULL OR "max_rental_after_trip_hours" >= 0)
 AND ("extension_request_cutoff_minutes" IS NULL OR "extension_request_cutoff_minutes" >= 0)
 AND ("extension_hold_minutes" IS NULL OR "extension_hold_minutes" > 0));
-- Backfill provenance only where values can be derived from existing confirmed Booking;
-- historical orders still do NOT acquire membership authorization retroactively.
UPDATE "rental_quotes" q SET "pickup_point_id" = b."pickup_point_id", "return_point_id" = b."return_point_id"
 FROM "bookings" b WHERE q."booking_id" = b."id";
DROP INDEX IF EXISTS "uq_rental_order_booking_open";
-- Reject migration if historical data contains >1 active order per user+trip; reconcile before retry.
CREATE UNIQUE INDEX "uq_rental_order_user_trip_open" ON "rental_orders" ("user_id", "trip_id")
 WHERE "status" IN ('PENDING_PAYMENT','PAID','PREPARING','READY_FOR_HANDOVER','ACTIVE','RETURN_PENDING','RETURN_PROCESSING');
CREATE INDEX "rental_orders_user_id_trip_id_status_idx" ON "rental_orders" ("user_id", "trip_id", "status");
CREATE TYPE "rental_extension_status" AS ENUM ('QUOTED','PENDING_PAYMENT','APPLIED','REJECTED_CAPACITY','EXPIRED','PAYMENT_FAILED','CANCELLED');
CREATE TABLE "rental_extension_requests" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
 "order_id" UUID NOT NULL REFERENCES "rental_orders"("id") ON DELETE RESTRICT,
 "user_id" UUID NOT NULL,
 "status" "rental_extension_status" NOT NULL DEFAULT 'QUOTED',
 "previous_rental_end_at" TIMESTAMPTZ(6) NOT NULL,
 "requested_rental_end_at" TIMESTAMPTZ(6) NOT NULL,
 "previous_occupied_until" TIMESTAMPTZ(6) NOT NULL,
 "requested_occupied_until" TIMESTAMPTZ(6) NOT NULL,
 "return_option_snapshot" JSONB NOT NULL,
 "additional_fee" DECIMAL(12,2) NOT NULL,
 "currency" CHAR(3) NOT NULL,
 "policy_snapshot" JSONB NOT NULL,
 "quoted_order_version" INTEGER NOT NULL,
 "quote_expires_at" TIMESTAMPTZ(6) NOT NULL,
 "hold_expires_at" TIMESTAMPTZ(6),
 "invoice_id" UUID UNIQUE,
 "payment_ref" UUID,
 "applied_at" TIMESTAMPTZ(6),
 "version" INTEGER NOT NULL DEFAULT 1,
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "extension_time_increases" CHECK ("requested_rental_end_at">"previous_rental_end_at" AND "requested_occupied_until">"previous_occupied_until")
);
CREATE TABLE "rental_extension_lines" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
 "extension_id" UUID NOT NULL REFERENCES "rental_extension_requests"("id") ON DELETE RESTRICT,
 "order_line_id" UUID NOT NULL REFERENCES "rental_order_lines"("id") ON DELETE RESTRICT,
 "previous_charged_days" INTEGER NOT NULL,
 "new_charged_days" INTEGER NOT NULL,
 "additional_fee" DECIMAL(12,2) NOT NULL,
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("extension_id", "order_line_id")
);
CREATE INDEX "rental_extension_requests_order_id_status_idx" ON "rental_extension_requests"("order_id", "status");
CREATE INDEX "rental_extension_requests_hold_expires_at_idx" ON "rental_extension_requests"("hold_expires_at");
-- At most one active extension; old QUOTED offers may coexist until selected/expired.
CREATE UNIQUE INDEX "uq_rental_extension_inflight" ON "rental_extension_requests"("order_id") WHERE "status" = 'PENDING_PAYMENT';
-- No new policy values are backfilled: NULL means not approved, and extension is denied.
