ALTER TABLE "gear_personal_catalog_items" ADD COLUMN "revoked_by" UUID;
ALTER TABLE "gear_personal_catalog_items" ADD COLUMN "revoked_at" TIMESTAMPTZ(6);
ALTER TABLE "gear_personal_catalog_items" DROP CONSTRAINT "gear_personal_catalog_state_check";
ALTER TABLE "gear_personal_catalog_items" ADD CONSTRAINT "gear_personal_catalog_state_check" CHECK ("state" IN ('DRAFT', 'VERIFIED', 'REVOKED'));
