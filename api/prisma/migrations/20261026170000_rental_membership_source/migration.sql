-- Additive only. Existing rows remain NULL and are handled explicitly as LEGACY by application code.
ALTER TABLE "rental_quotes"
  ADD COLUMN IF NOT EXISTS "membership_kind" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "membership_source_version" INTEGER;

ALTER TABLE "rental_orders"
  ADD COLUMN IF NOT EXISTS "membership_kind" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "membership_source_version" INTEGER;

CREATE INDEX IF NOT EXISTS "rental_quotes_membership_kind_membership_ref_status_idx"
  ON "rental_quotes"("membership_kind", "membership_ref", "status");

CREATE INDEX IF NOT EXISTS "rental_orders_membership_kind_membership_ref_status_idx"
  ON "rental_orders"("membership_kind", "membership_ref", "status");
