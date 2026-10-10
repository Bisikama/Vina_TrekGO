-- B6 return / inspection / deposit settlement foundation (RB-API-601..616).
-- Additive to B1-B5. Policy values marked CẦN CHỐT remain nullable/versioned.

ALTER TABLE "rental_policies"
  ADD COLUMN IF NOT EXISTS "deep_inspection_review_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "admin_approval_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "user_assessment_review_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "lost_confirmation_minutes" INTEGER;

-- Functional Requirements use evidenceIds for USER assessment reviews. Keep the
-- historical evidence_urls field for backwards compatibility; new B6 code writes IDs.
ALTER TABLE "rental_assessment_reviews"
  ADD COLUMN IF NOT EXISTS "evidence_ids" JSONB;

-- Return direction custody is semantically Delivery -> Inventory. The older
-- custody_transfers table is intentionally kept for B3 Inventory -> Delivery.
CREATE TABLE IF NOT EXISTS "return_custody_transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "delivery_task_id" UUID NOT NULL,
  "inventory_location_id" UUID NOT NULL,
  "from_staff_id" UUID NOT NULL,
  "unit_ids" JSONB NOT NULL,
  "received_unit_ids" JSONB,
  "status" "custody_transfer_status" NOT NULL DEFAULT 'PENDING_RECEIPT',
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "received_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "return_custody_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "return_custody_transfers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "return_custody_transfers_delivery_task_id_fkey" FOREIGN KEY ("delivery_task_id") REFERENCES "delivery_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "return_custody_transfers_inventory_location_id_fkey" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "return_custody_transfers_from_staff_id_fkey" FOREIGN KEY ("from_staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "return_custody_transfers_order_id_status_requested_at_idx"
ON "return_custody_transfers" ("order_id", "status", "requested_at");

CREATE INDEX IF NOT EXISTS "return_custody_transfers_delivery_task_id_status_idx"
ON "return_custody_transfers" ("delivery_task_id", "status");

CREATE INDEX IF NOT EXISTS "return_custody_transfers_inventory_location_id_status_idx"
ON "return_custody_transfers" ("inventory_location_id", "status");

-- A RETURN task may have only one pending warehouse custody request at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_return_custody_transfer_task_pending"
ON "return_custody_transfers" ("delivery_task_id")
WHERE "status" = 'PENDING_RECEIPT';

-- Prevent duplicate open review cases for the same concrete inspection.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_rental_exception_case_inspection_active"
ON "rental_exception_cases" ("inspection_id", "case_type")
WHERE "inspection_id" IS NOT NULL
  AND "status" IN ('OPEN', 'UNDER_REVIEW');

-- Useful scans for B6 queues.
CREATE INDEX IF NOT EXISTS "return_inspections_order_id_stage_outcome_idx"
ON "return_inspections" ("order_id", "stage", "outcome");

CREATE INDEX IF NOT EXISTS "deposit_settlement_items_settlement_id_status_idx"
ON "deposit_settlement_items" ("settlement_id", "status");
