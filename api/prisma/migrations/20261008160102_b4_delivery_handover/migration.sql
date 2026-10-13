-- B4 logistics handover foundation (RB-API-401..412).
-- Additive to B1/B2/B3. Does not change B1-B3 public API semantics.

-- Policy values are server-side/versioned. The current Policy v1.3 still marks
-- these exact minute values as requiring team approval, so this migration DOES NOT
-- hardcode 15/10. Populate them in the effective RentalPolicy version before B4 use.
ALTER TABLE "rental_policies"
  ADD COLUMN IF NOT EXISTS "pickup_code_ttl_minutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "pickup_verification_ttl_minutes" INTEGER;

-- Preserve no-show/refusal evidence on the logistics task itself.
ALTER TABLE "delivery_tasks"
  ADD COLUMN IF NOT EXISTS "exception_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "exception_evidence_ids" JSONB,
  ADD COLUMN IF NOT EXISTS "exception_at" TIMESTAMPTZ(6);

-- One active, unconsumed code per order. Historical/revoked/used codes remain for audit.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_rental_pickup_code_order_active"
ON "rental_pickup_codes" ("order_id")
WHERE "used_at" IS NULL AND "revoked_at" IS NULL;

-- Fast lookup for a verified-but-not-yet-consumed pickup verification.
CREATE INDEX IF NOT EXISTS "rental_pickup_codes_order_verification_idx"
ON "rental_pickup_codes" ("order_id", "verification_ref", "verified_at");
