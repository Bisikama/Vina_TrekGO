-- Area B SOT 1.5.2: additive changes only. Do NOT apply to a production database blindly.
-- New policy rows must be published separately with a new versionNo; never mutate historical order snapshots.
ALTER TABLE rental_policies ADD COLUMN IF NOT EXISTS return_inspection_sla_hours INTEGER;
ALTER TABLE rental_policies ADD COLUMN IF NOT EXISTS deep_inspection_sla_hours INTEGER;
ALTER TABLE rental_policies ADD COLUMN IF NOT EXISTS return_to_inventory_allowance_hours INTEGER;
ALTER TABLE rental_policies ADD COLUMN IF NOT EXISTS post_inspection_cleaning_allowance_hours INTEGER;
ALTER TABLE rental_policies ADD CONSTRAINT rental_policy_inspection_slas_positive CHECK (
  (return_inspection_sla_hours IS NULL OR return_inspection_sla_hours > 0) AND
  (deep_inspection_sla_hours IS NULL OR deep_inspection_sla_hours > 0) AND
  (return_to_inventory_allowance_hours IS NULL OR return_to_inventory_allowance_hours >= 0) AND
  (post_inspection_cleaning_allowance_hours IS NULL OR post_inspection_cleaning_allowance_hours >= 0)
);
CREATE TABLE IF NOT EXISTS return_inspection_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES rental_orders(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL UNIQUE REFERENCES rental_unit_assignments(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES equipment_units(id) ON DELETE RESTRICT,
  inventory_location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE RESTRICT,
  received_at TIMESTAMPTZ NOT NULL, inspection_due_at TIMESTAMPTZ NOT NULL,
  deep_inspection_due_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING', created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT return_inspection_task_status_ck CHECK(status IN ('PENDING','IN_PROGRESS','COMPLETED')),
  CONSTRAINT return_inspection_due_ck CHECK (inspection_due_at > received_at AND (deep_inspection_due_at IS NULL OR deep_inspection_due_at > received_at))
);
CREATE INDEX IF NOT EXISTS return_inspection_tasks_status_inspection_due_at_idx ON return_inspection_tasks(status,inspection_due_at);
CREATE INDEX IF NOT EXISTS return_inspection_tasks_inventory_location_id_status_inspection_due_at_idx ON return_inspection_tasks(inventory_location_id,status,inspection_due_at);
CREATE TABLE IF NOT EXISTS deposit_refund_item_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE RESTRICT,
  deposit_settlement_item_id UUID NOT NULL UNIQUE REFERENCES deposit_settlement_items(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK(amount > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (refund_id,deposit_settlement_item_id)
);
CREATE INDEX IF NOT EXISTS deposit_refund_item_allocations_refund_id_idx ON deposit_refund_item_allocations(refund_id);
-- Existing policies must NOT be backfilled without product-owner approval of effective dates.
-- New policyVersion 1.5.2 requires 72/24/8/8; nominal buffers remain 24 OR 48 (not additive).
