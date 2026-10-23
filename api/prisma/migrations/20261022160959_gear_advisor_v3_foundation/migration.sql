-- CreateEnum
CREATE TYPE "gear_category" AS ENUM ('JACKET', 'FOOTWEAR', 'PANTS', 'BACKPACK', 'SLEEPING_BAG', 'TENT', 'TREKKING_POLE', 'RAIN_GEAR');

-- CreateEnum
CREATE TYPE "gear_rule_category" AS ENUM ('JACKET', 'FOOTWEAR', 'PANTS', 'BACKPACK', 'SLEEPING_BAG', 'GENERAL');

-- CreateEnum
CREATE TYPE "gear_condition" AS ENUM ('NEW', 'GOOD', 'WORN', 'POOR');

-- CreateEnum
CREATE TYPE "gear_item_source" AS ENUM ('MANUAL', 'AI_IMAGE', 'AI_LINK');

-- CreateEnum
CREATE TYPE "gear_extraction_source_type" AS ENUM ('IMAGE', 'LINK');

-- CreateEnum
CREATE TYPE "gear_extraction_status" AS ENUM ('PENDING', 'READY', 'FAILED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "gear_plan_context_mode" AS ENUM ('TRIP', 'MANUAL');

-- CreateEnum
CREATE TYPE "gear_option_objective" AS ENUM ('ECONOMICAL', 'LIGHTWEIGHT', 'BALANCED');

-- CreateEnum
CREATE TYPE "gear_advice_source" AS ENUM ('AI', 'CACHE', 'RULE_FALLBACK');

-- CreateEnum
CREATE TYPE "gear_verdict" AS ENUM ('SUITABLE', 'NOT_SUITABLE');

-- AlterEnum
ALTER TYPE "media_scope" ADD VALUE 'USER_GEAR';

-- CreateTable
CREATE TABLE "user_gear_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" "gear_category" NOT NULL,
    "brand" VARCHAR(100),
    "condition" "gear_condition" NOT NULL DEFAULT 'GOOD',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "photo_ref" UUID,
    "source" "gear_item_source" NOT NULL DEFAULT 'MANUAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_gear_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_requirement_rules" (
    "id" VARCHAR(10) NOT NULL,
    "category" "gear_rule_category" NOT NULL,
    "default_verdict" "gear_verdict",
    "template_vi" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rule_version" VARCHAR(20) NOT NULL DEFAULT '3.1',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_requirement_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_extraction_drafts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_type" "gear_extraction_source_type" NOT NULL,
    "source_hash" VARCHAR(64) NOT NULL,
    "status" "gear_extraction_status" NOT NULL DEFAULT 'PENDING',
    "extracted_data" JSONB,
    "confirmed_item_id" UUID,
    "confirmation_payload_hash" VARCHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_extraction_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_extraction_cache" (
    "id" UUID NOT NULL,
    "owner_scope" VARCHAR(64) NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "prompt_version" VARCHAR(20) NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "schema_version" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    "result_json" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_extraction_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_extraction_leases" (
    "id" UUID NOT NULL,
    "resource_key" VARCHAR(255) NOT NULL,
    "owner_token" VARCHAR(64) NOT NULL,
    "fencing_token" INTEGER NOT NULL DEFAULT 1,
    "lease_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_extraction_leases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(220) NOT NULL,
    "context_mode" "gear_plan_context_mode" NOT NULL DEFAULT 'TRIP',
    "trip_id" UUID,
    "selected_item_ids" JSONB NOT NULL DEFAULT '[]',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "canonical_context" JSONB NOT NULL DEFAULT '{}',
    "input_revision" INTEGER NOT NULL DEFAULT 1,
    "evaluated_revision" INTEGER,
    "progress_version" INTEGER NOT NULL DEFAULT 1,
    "progress_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_plan_revisions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "result_snapshot" JSONB NOT NULL,
    "context_version" VARCHAR(20) NOT NULL DEFAULT '3.1',
    "rule_versions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_plan_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_plan_option_sets" (
    "id" UUID NOT NULL,
    "plan_revision_id" UUID NOT NULL,
    "objective" "gear_option_objective" NOT NULL DEFAULT 'BALANCED',
    "search_scope" JSONB NOT NULL DEFAULT '{}',
    "options_json" JSONB NOT NULL DEFAULT '[]',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_plan_option_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_advice_runs" (
    "id" UUID NOT NULL,
    "plan_revision_id" UUID NOT NULL,
    "source" "gear_advice_source" NOT NULL DEFAULT 'AI',
    "context_hash" VARCHAR(64) NOT NULL,
    "narrative_vi" TEXT NOT NULL,
    "fact_refs" JSONB NOT NULL DEFAULT '[]',
    "action_refs" JSONB NOT NULL DEFAULT '[]',
    "candidate_refs" JSONB NOT NULL DEFAULT '[]',
    "disclaimer_vi" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "token_usage" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_advice_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_quote_links" (
    "id" UUID NOT NULL,
    "plan_revision_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "verified_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gear_quote_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_technical_profiles" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "category" "gear_category" NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_technical_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_gear_item_user_idx" ON "user_gear_items"("user_id");

-- CreateIndex
CREATE INDEX "user_gear_item_category_idx" ON "user_gear_items"("category");

-- CreateIndex
CREATE INDEX "gear_requirement_rule_category_idx" ON "gear_requirement_rules"("category");

-- CreateIndex
CREATE UNIQUE INDEX "gear_extraction_drafts_confirmed_item_id_key" ON "gear_extraction_drafts"("confirmed_item_id");

-- CreateIndex
CREATE INDEX "gear_extraction_draft_user_idx" ON "gear_extraction_drafts"("user_id");

-- CreateIndex
CREATE INDEX "gear_extraction_draft_source_hash_idx" ON "gear_extraction_drafts"("source_hash");

-- CreateIndex
CREATE INDEX "gear_extraction_draft_expires_idx" ON "gear_extraction_drafts"("expires_at");

-- CreateIndex
CREATE INDEX "gear_extraction_cache_expires_idx" ON "gear_extraction_cache"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "gear_extraction_cache_identity_key" ON "gear_extraction_cache"("owner_scope", "content_hash", "prompt_version", "model_version", "schema_version");

-- CreateIndex
CREATE UNIQUE INDEX "gear_extraction_leases_resource_key_key" ON "gear_extraction_leases"("resource_key");

-- CreateIndex
CREATE INDEX "gear_extraction_lease_expires_idx" ON "gear_extraction_leases"("lease_expires_at");

-- CreateIndex
CREATE INDEX "gear_plan_user_idx" ON "gear_plans"("user_id");

-- CreateIndex
CREATE INDEX "gear_plan_trip_idx" ON "gear_plans"("trip_id");

-- CreateIndex
CREATE INDEX "gear_plan_revision_plan_idx" ON "gear_plan_revisions"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "gear_plan_revision_plan_id_revision_key" ON "gear_plan_revisions"("plan_id", "revision");

-- CreateIndex
CREATE INDEX "gear_plan_option_set_plan_rev_idx" ON "gear_plan_option_sets"("plan_revision_id");

-- CreateIndex
CREATE INDEX "gear_plan_option_set_expires_idx" ON "gear_plan_option_sets"("expires_at");

-- CreateIndex
CREATE INDEX "gear_advice_run_plan_rev_idx" ON "gear_advice_runs"("plan_revision_id");

-- CreateIndex
CREATE INDEX "gear_quote_link_user_idx" ON "gear_quote_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gear_quote_link_plan_rev_quote_key" ON "gear_quote_links"("plan_revision_id", "quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_technical_profiles_product_id_key" ON "product_technical_profiles"("product_id");

-- CreateIndex
CREATE INDEX "product_technical_profile_category_idx" ON "product_technical_profiles"("category");

-- AddForeignKey
ALTER TABLE "user_gear_items" ADD CONSTRAINT "user_gear_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_gear_items" ADD CONSTRAINT "user_gear_items_photo_ref_fkey" FOREIGN KEY ("photo_ref") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_extraction_drafts" ADD CONSTRAINT "gear_extraction_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_extraction_drafts" ADD CONSTRAINT "gear_extraction_drafts_confirmed_item_id_fkey" FOREIGN KEY ("confirmed_item_id") REFERENCES "user_gear_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_plans" ADD CONSTRAINT "gear_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_plans" ADD CONSTRAINT "gear_plans_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_plan_revisions" ADD CONSTRAINT "gear_plan_revisions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "gear_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_plan_option_sets" ADD CONSTRAINT "gear_plan_option_sets_plan_revision_id_fkey" FOREIGN KEY ("plan_revision_id") REFERENCES "gear_plan_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_advice_runs" ADD CONSTRAINT "gear_advice_runs_plan_revision_id_fkey" FOREIGN KEY ("plan_revision_id") REFERENCES "gear_plan_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_quote_links" ADD CONSTRAINT "gear_quote_links_plan_revision_id_fkey" FOREIGN KEY ("plan_revision_id") REFERENCES "gear_plan_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_quote_links" ADD CONSTRAINT "gear_quote_links_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "rental_quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gear_quote_links" ADD CONSTRAINT "gear_quote_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_technical_profiles" ADD CONSTRAINT "product_technical_profiles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "rental_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
