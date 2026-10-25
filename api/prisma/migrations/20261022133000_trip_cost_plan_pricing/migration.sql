-- CreateEnum
CREATE TYPE "trip_cost_category" AS ENUM ('TRANSPORT', 'STAFF', 'FOOD', 'ACCOMMODATION', 'ACCESS', 'SAFETY', 'LOGISTICS', 'OTHER');

-- CreateEnum
CREATE TYPE "trip_cost_kind" AS ENUM ('FIXED', 'VARIABLE', 'STEP');

-- CreateEnum
CREATE TYPE "trip_cost_basis" AS ENUM ('PER_TRIP', 'PER_DAY', 'PER_PERSON', 'PER_PERSON_PER_DAY', 'PER_CAPACITY_UNIT', 'PER_GROUP_TIER');

-- CreateEnum
CREATE TYPE "step_tier_operation" AS ENUM ('ADDITIVE', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "trip_cost_plan_status" AS ENUM ('DRAFT', 'CONFIRMED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "trip_cost_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'VND',
    "target_pax" INTEGER NOT NULL,
    "target_margin_bps" INTEGER NOT NULL DEFAULT 1200,
    "contingency_bps" INTEGER NOT NULL DEFAULT 500,
    "selected_price" DECIMAL(12,2),
    "selected_min_pax" INTEGER,
    "calc_version" VARCHAR(40) NOT NULL DEFAULT 'pricing-v1',
    "policy_version_ref" VARCHAR(80),
    "status" "trip_cost_plan_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_cost_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_cost_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cost_plan_id" UUID NOT NULL,
    "category" "trip_cost_category" NOT NULL,
    "name_snapshot" VARCHAR(160) NOT NULL,
    "kind" "trip_cost_kind" NOT NULL,
    "basis" "trip_cost_basis" NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "duration_units" INTEGER NOT NULL DEFAULT 1,
    "capacity_per_unit" INTEGER,
    "extra_non_paying_pax" INTEGER NOT NULL DEFAULT 0,
    "included_in_price" BOOLEAN NOT NULL DEFAULT true,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "source_note" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "trip_cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_cost_step_tiers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cost_item_id" UUID NOT NULL,
    "trigger_min_pax" INTEGER NOT NULL,
    "trigger_max_pax" INTEGER NOT NULL,
    "operation" "step_tier_operation" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" VARCHAR(200),

    CONSTRAINT "trip_cost_step_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_pricing_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "selected_price" DECIMAL(12,2) NOT NULL,
    "selected_min_pax" INTEGER NOT NULL,
    "target_pax" INTEGER NOT NULL,
    "cost_input_snapshot" JSONB NOT NULL,
    "fee_assumption_snapshot" JSONB NOT NULL,
    "pricing_result_snapshot" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_pricing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_cost_plans_trip_id_key" ON "trip_cost_plans"("trip_id");

-- CreateIndex
CREATE INDEX "trip_cost_items_cost_plan_id_sort_order_idx" ON "trip_cost_items"("cost_plan_id", "sort_order");

-- CreateIndex
CREATE INDEX "trip_cost_step_tiers_cost_item_id_trigger_min_pax_idx" ON "trip_cost_step_tiers"("cost_item_id", "trigger_min_pax");

-- CreateIndex
CREATE INDEX "trip_pricing_versions_trip_id_published_at_idx" ON "trip_pricing_versions"("trip_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "trip_pricing_versions_trip_id_version_no_key" ON "trip_pricing_versions"("trip_id", "version_no");

-- AddForeignKey
ALTER TABLE "trip_cost_plans" ADD CONSTRAINT "trip_cost_plans_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_cost_items" ADD CONSTRAINT "trip_cost_items_cost_plan_id_fkey" FOREIGN KEY ("cost_plan_id") REFERENCES "trip_cost_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_cost_step_tiers" ADD CONSTRAINT "trip_cost_step_tiers_cost_item_id_fkey" FOREIGN KEY ("cost_item_id") REFERENCES "trip_cost_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_pricing_versions" ADD CONSTRAINT "trip_pricing_versions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
