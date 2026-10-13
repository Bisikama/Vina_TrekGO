-- B5 active rental tracking / trip-change / return-task foundation.
-- Additive to B1-B4. Public RB-API-501/502 reuse RB-API-202/203.

-- Policy v1.3 still marks the exact overdue-review threshold as CẦN CHỐT.
-- Keep it nullable/versioned; do not hardcode the proposed 120 minutes here.
ALTER TABLE "rental_policies"
  ADD COLUMN IF NOT EXISTS "overdue_review_minutes" INTEGER;

-- B5 needs the operational handover/return times as first-class snapshots.
-- Existing rows are backfilled from trip billing dates as a compatibility baseline;
-- new B1 quotes persist the real pickup/dropoff schedule from RentalContext.
ALTER TABLE "rental_quotes"
  ADD COLUMN IF NOT EXISTS "planned_handover_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "planned_return_at" TIMESTAMPTZ(6);

UPDATE "rental_quotes"
SET "planned_handover_at" = COALESCE("planned_handover_at", "rental_start_at"),
    "planned_return_at" = COALESCE("planned_return_at", "rental_end_at")
WHERE "planned_handover_at" IS NULL OR "planned_return_at" IS NULL;

ALTER TABLE "rental_quotes"
  ALTER COLUMN "planned_handover_at" SET NOT NULL,
  ALTER COLUMN "planned_return_at" SET NOT NULL;

ALTER TABLE "rental_orders"
  ADD COLUMN IF NOT EXISTS "planned_handover_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "planned_return_at" TIMESTAMPTZ(6);

UPDATE "rental_orders"
SET "planned_handover_at" = COALESCE("planned_handover_at", "rental_start_at"),
    "planned_return_at" = COALESCE("planned_return_at", "rental_end_at")
WHERE "planned_handover_at" IS NULL OR "planned_return_at" IS NULL;

ALTER TABLE "rental_orders"
  ALTER COLUMN "planned_handover_at" SET NOT NULL,
  ALTER COLUMN "planned_return_at" SET NOT NULL;

-- Integration inbox for Area A -> Area B events.
CREATE TABLE IF NOT EXISTS "rental_inbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "event_id" VARCHAR(220) NOT NULL,
  "event_type" VARCHAR(140) NOT NULL,
  "entity_id" UUID NOT NULL,
  "entity_version" INTEGER NOT NULL,
  "correlation_id" VARCHAR(220) NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "status" "event_status" NOT NULL DEFAULT 'PENDING',
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),
  CONSTRAINT "rental_inbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rental_inbox_events_event_id_key"
ON "rental_inbox_events" ("event_id");

CREATE INDEX IF NOT EXISTS "rental_inbox_events_event_type_entity_id_entity_version_idx"
ON "rental_inbox_events" ("event_type", "entity_id", "entity_version");

CREATE INDEX IF NOT EXISTS "rental_inbox_events_status_created_at_idx"
ON "rental_inbox_events" ("status", "created_at");

-- Scheduler may run repeatedly. Prevent duplicate active OVERDUE cases per assignment.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_rental_overdue_case_assignment_active"
ON "rental_exception_cases" ("assignment_id", "case_type")
WHERE "assignment_id" IS NOT NULL
  AND "case_type" = 'OVERDUE'
  AND "status" IN ('OPEN', 'UNDER_REVIEW');

-- Helpful for due-return/overdue scheduler scans.
CREATE INDEX IF NOT EXISTS "rental_orders_status_planned_return_at_idx"
ON "rental_orders" ("status", "planned_return_at");
