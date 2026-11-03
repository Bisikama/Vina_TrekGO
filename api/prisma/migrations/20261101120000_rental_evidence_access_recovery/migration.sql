ALTER TABLE "rental_exception_cases"
  ADD COLUMN "evidence_access_blocked_at" TIMESTAMPTZ(6),
  ADD COLUMN "evidence_access_customer_confirmation_required" BOOLEAN NOT NULL DEFAULT false;
