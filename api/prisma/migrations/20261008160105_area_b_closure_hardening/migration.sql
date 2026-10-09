-- Area B Closure / Integration Hardening
-- Adds the remaining versioned policy fields required by RB-API-703/704.
DO $$ BEGIN
  CREATE TYPE "rental_day_count_mode" AS ENUM ('CEIL_24H');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "rental_policies"
  ADD COLUMN IF NOT EXISTS "currency" CHAR(3) NOT NULL DEFAULT 'VND',
  ADD COLUMN IF NOT EXISTS "day_count_mode" "rental_day_count_mode" NOT NULL DEFAULT 'CEIL_24H';
