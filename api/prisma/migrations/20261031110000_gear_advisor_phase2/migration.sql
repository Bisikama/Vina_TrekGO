-- Additive Gear Advisor phase 2 data. Existing items retain unknown provenance.
ALTER TABLE "user_gear_items" ADD COLUMN "attribute_provenance" JSONB;

CREATE TABLE "gear_plan_preparation_selections" (
  "plan_id" UUID NOT NULL,
  "choices" JSONB NOT NULL DEFAULT '[]',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gear_plan_preparation_selections_pkey" PRIMARY KEY ("plan_id"),
  CONSTRAINT "gear_plan_preparation_selections_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "gear_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "gear_personal_catalog_items" (
  "id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "brand" VARCHAR(100),
  "category" "gear_category" NOT NULL,
  "attributes" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "state" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID NOT NULL,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gear_personal_catalog_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gear_personal_catalog_state_check" CHECK ("state" IN ('DRAFT', 'VERIFIED'))
);
CREATE INDEX "gear_personal_catalog_state_category_idx" ON "gear_personal_catalog_items" ("state", "category");
