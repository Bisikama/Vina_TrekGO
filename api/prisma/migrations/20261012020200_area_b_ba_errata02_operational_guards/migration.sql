-- Additive BA ERRATA operational safety; do not edit applied history.
ALTER TABLE "return_custody_transfers" ADD COLUMN IF NOT EXISTS "transfer_started_at" TIMESTAMPTZ(6);
ALTER TABLE "return_custody_transfers" ADD COLUMN IF NOT EXISTS "transfer_watch_at" TIMESTAMPTZ(6);
ALTER TABLE "return_custody_transfers" ADD COLUMN IF NOT EXISTS "delayed_at" TIMESTAMPTZ(6);
ALTER TABLE "return_custody_transfers" ADD COLUMN IF NOT EXISTS "monitoring_status" VARCHAR(32) NOT NULL DEFAULT 'ON_TIME';
CREATE INDEX IF NOT EXISTS "return_custody_transfers_status_transfer_watch_at_delayed_at_idx" ON "return_custody_transfers"("status","transfer_watch_at","delayed_at");
ALTER TABLE "rental_exception_cases" ADD COLUMN IF NOT EXISTS "evidence_complete_at" TIMESTAMPTZ(6);
ALTER TABLE "rental_exception_cases" ADD COLUMN IF NOT EXISTS "admin_approval_due_at" TIMESTAMPTZ(6);
ALTER TABLE "rental_exception_cases" ADD COLUMN IF NOT EXISTS "admin_sla_breached_at" TIMESTAMPTZ(6);
ALTER TABLE "rental_exception_cases" ADD COLUMN IF NOT EXISTS "evidence_published_at" TIMESTAMPTZ(6);
ALTER TABLE "rental_exception_cases" ADD COLUMN IF NOT EXISTS "in_app_notice_published_at" TIMESTAMPTZ(6);
ALTER TABLE "rental_exception_cases" ADD COLUMN IF NOT EXISTS "evidence_accessible_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "rental_exception_cases_status_admin_approval_due_at_admin_sla_breached_at_idx" ON "rental_exception_cases"("status","admin_approval_due_at","admin_sla_breached_at");
CREATE TABLE IF NOT EXISTS "rental_readiness_commitments" (
  "id" UUID NOT NULL PRIMARY KEY, "unit_id" UUID NOT NULL UNIQUE,
  "ready_by" TIMESTAMPTZ(6) NOT NULL, "valid_until" TIMESTAMPTZ(6) NOT NULL,
  "verified_at" TIMESTAMPTZ(6) NOT NULL, "verified_by" UUID NOT NULL,
  "evidence_ref" VARCHAR(200) NOT NULL, "status" VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "rental_readiness_commitments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rental_readiness_valid_window" CHECK ("valid_until" > "ready_by"),
  CONSTRAINT "rental_readiness_evidence_required" CHECK (length(trim("evidence_ref")) > 0)
);
CREATE INDEX IF NOT EXISTS "rental_readiness_commitments_status_ready_by_valid_until_idx" ON "rental_readiness_commitments"("status","ready_by","valid_until");

ALTER TABLE "rental_exception_cases" ADD COLUMN IF NOT EXISTS "admin_review_status" VARCHAR(32) NOT NULL DEFAULT 'PENDING';

CREATE TABLE IF NOT EXISTS "rental_capacity_alerts" (
  "alert_key" VARCHAR(120) NOT NULL PRIMARY KEY, "product_id" UUID NOT NULL,
  "occupied_from" TIMESTAMPTZ(6) NOT NULL, "occupied_until" TIMESTAMPTZ(6) NOT NULL,
  "requested_quantity" INTEGER NOT NULL, "available_count" INTEGER NOT NULL,
  "unknown_unit_count" INTEGER NOT NULL, "status" VARCHAR(32) NOT NULL DEFAULT 'ACTION_REQUIRED',
  "reason" VARCHAR(120) NOT NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS "rental_capacity_alerts_product_id_status_idx" ON "rental_capacity_alerts"("product_id","status");

ALTER TABLE "rental_quote_lines" ADD COLUMN IF NOT EXISTS "occupied_from" TIMESTAMPTZ(6);
ALTER TABLE "rental_quote_lines" ADD COLUMN IF NOT EXISTS "occupied_until" TIMESTAMPTZ(6);
