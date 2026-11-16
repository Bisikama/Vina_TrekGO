-- Intake batch, shelf life and wear of a physical unit (demo feedback 11/11).
-- expires_at: last day the unit may still be rented out is the day before; NULL = no shelf life.
-- rental_count: completed rental cycles (unit came back and was released to stock again).
ALTER TABLE "equipment_units"
  ADD COLUMN "intake_batch_code" VARCHAR(60),
  ADD COLUMN "expires_at" DATE,
  ADD COLUMN "condition_notes" TEXT,
  ADD COLUMN "rental_count" INTEGER NOT NULL DEFAULT 0;

-- max_rental_cycles: NULL = no wear limit for units of this product.
ALTER TABLE "rental_products" ADD COLUMN "max_rental_cycles" INTEGER;

ALTER TABLE "equipment_units" ADD CONSTRAINT "equipment_units_rental_count_non_negative" CHECK ("rental_count" >= 0);
ALTER TABLE "rental_products" ADD CONSTRAINT "rental_products_max_rental_cycles_positive" CHECK ("max_rental_cycles" IS NULL OR "max_rental_cycles" > 0);

CREATE INDEX "equipment_units_intake_batch_code_idx" ON "equipment_units"("intake_batch_code");
CREATE INDEX "equipment_units_status_expires_at_idx" ON "equipment_units"("status", "expires_at");
