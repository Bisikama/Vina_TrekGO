-- Preserve legacy rows. Fail explicitly instead of rewriting financial history if conflicts exist.
BEGIN;
LOCK TABLE "invoices" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "invoices" WHERE "trail_access_id" IS NOT NULL
    GROUP BY "trail_access_id", "revision_no" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate trail invoice revisions require review before migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "invoices" WHERE "trail_access_id" IS NOT NULL
    AND "status" IN ('DRAFT', 'PENDING_PAYMENT') GROUP BY "trail_access_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Multiple open trail invoices require review before migration';
  END IF;
END $$;
CREATE UNIQUE INDEX "invoices_trail_access_id_revision_no_key" ON "invoices"("trail_access_id", "revision_no");
CREATE UNIQUE INDEX "uq_invoice_open_trail" ON "invoices"("trail_access_id")
  WHERE "trail_access_id" IS NOT NULL AND "status" IN ('DRAFT', 'PENDING_PAYMENT');
COMMIT;
