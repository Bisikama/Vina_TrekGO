-- RB-API-602: keep what Delivery observed at pickup (visible damage, accessory notes) so Inventory can see it.
ALTER TABLE "return_inspections" ADD COLUMN "observations" JSONB;
