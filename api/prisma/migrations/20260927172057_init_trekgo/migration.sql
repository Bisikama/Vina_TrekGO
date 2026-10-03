/*
  Warnings:

  - The values [LOGISTICS] on the enum `custody_actor_type` will be removed. If these variants are still used in the database, this will fail.
  - The values [INVENTORY_TO_LOGISTICS,LOGISTICS_TO_USER,USER_TO_LOGISTICS,LOGISTICS_TO_INVENTORY] on the enum `custody_event_type` will be removed. If these variants are still used in the database, this will fail.
  - The values [APPROVED,REJECTED] on the enum `deposit_item_status` will be removed. If these variants are still used in the database, this will fail.
  - The values [TRANSFERRED_TO_LOGISTICS] on the enum `package_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `logistics_status_after` on the `custody_events` table. All the data in the column will be lost.
  - You are about to drop the column `logistics_status_before` on the `custody_events` table. All the data in the column will be lost.
  - You are about to drop the column `logistics_task_id` on the `custody_events` table. All the data in the column will be lost.
  - You are about to drop the column `requested_type` on the `leader_applications` table. All the data in the column will be lost.
  - You are about to drop the column `leader_type` on the `leader_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `refund_type` on the `refunds` table. All the data in the column will be lost.
  - You are about to drop the column `logistics_task_id` on the `rental_handovers` table. All the data in the column will be lost.
  - You are about to drop the column `damage_deduction_rules` on the `rental_policies` table. All the data in the column will be lost.
  - You are about to drop the column `quantity_rules` on the `rental_policies` table. All the data in the column will be lost.
  - You are about to drop the `logistics_tasks` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[delivery_task_id]` on the table `rental_handovers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `purpose` to the `refunds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `delivery_task_id` to the `rental_handovers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "delivery_task_type" AS ENUM ('HANDOVER', 'RETURN');

-- CreateEnum
CREATE TYPE "delivery_task_status" AS ENUM ('SCHEDULED', 'PACKAGE_RECEIVED', 'RECIPIENT_VERIFIED', 'HANDED_OVER', 'COLLECTING', 'RETURNED', 'INVENTORY_RECEIVED', 'NO_SHOW', 'REFUSED', 'CLOSED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "damage_severity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'TOTAL_LOSS');

-- CreateEnum
CREATE TYPE "damage_deduction_type" AS ENUM ('FIXED', 'PERCENT_DEPOSIT', 'PERCENT_REPLACEMENT_VALUE');

-- CreateEnum
CREATE TYPE "refund_purpose" AS ENUM ('DEPOSIT', 'BOOKING_CANCELLATION', 'RENTAL_CANCELLATION', 'TRAIL_ACCESS');

-- AlterEnum
BEGIN;
CREATE TYPE "custody_actor_type_new" AS ENUM ('INVENTORY_LOCATION', 'DELIVERY_STAFF', 'USER', 'SYSTEM');
ALTER TABLE "custody_events" ALTER COLUMN "from_actor_type" TYPE "custody_actor_type_new" USING ("from_actor_type"::text::"custody_actor_type_new");
ALTER TABLE "custody_events" ALTER COLUMN "to_actor_type" TYPE "custody_actor_type_new" USING ("to_actor_type"::text::"custody_actor_type_new");
ALTER TYPE "custody_actor_type" RENAME TO "custody_actor_type_old";
ALTER TYPE "custody_actor_type_new" RENAME TO "custody_actor_type";
DROP TYPE "custody_actor_type_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "custody_event_type_new" AS ENUM ('INVENTORY_TO_DELIVERY', 'DELIVERY_TO_USER', 'USER_TO_DELIVERY', 'DELIVERY_TO_INVENTORY', 'INTERNAL_TRANSFER');
ALTER TABLE "custody_events" ALTER COLUMN "event_type" TYPE "custody_event_type_new" USING ("event_type"::text::"custody_event_type_new");
ALTER TYPE "custody_event_type" RENAME TO "custody_event_type_old";
ALTER TYPE "custody_event_type_new" RENAME TO "custody_event_type";
DROP TYPE "custody_event_type_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "deposit_item_status_new" AS ENUM ('HELD', 'REVIEW_REQUIRED', 'DEDUCTION_APPROVED', 'DEDUCTION_REJECTED', 'REFUND_PENDING', 'REFUND_FAILED', 'SETTLED');
ALTER TABLE "deposit_settlement_items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "deposit_settlement_items" ALTER COLUMN "status" TYPE "deposit_item_status_new" USING ("status"::text::"deposit_item_status_new");
ALTER TYPE "deposit_item_status" RENAME TO "deposit_item_status_old";
ALTER TYPE "deposit_item_status_new" RENAME TO "deposit_item_status";
DROP TYPE "deposit_item_status_old";
ALTER TABLE "deposit_settlement_items" ALTER COLUMN "status" SET DEFAULT 'HELD';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "package_status_new" AS ENUM ('OPEN', 'PACKED', 'READY', 'TRANSFERRED_TO_DELIVERY', 'HANDED_OVER', 'RETURNING', 'RETURNED_TO_INVENTORY', 'CLOSED', 'CANCELLED');
ALTER TABLE "packages" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "packages" ALTER COLUMN "status" TYPE "package_status_new" USING ("status"::text::"package_status_new");
ALTER TABLE "custody_events" ALTER COLUMN "package_status_before" TYPE "package_status_new" USING ("package_status_before"::text::"package_status_new");
ALTER TABLE "custody_events" ALTER COLUMN "package_status_after" TYPE "package_status_new" USING ("package_status_after"::text::"package_status_new");
ALTER TYPE "package_status" RENAME TO "package_status_old";
ALTER TYPE "package_status_new" RENAME TO "package_status";
DROP TYPE "package_status_old";
ALTER TABLE "packages" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- DropForeignKey
ALTER TABLE "custody_events" DROP CONSTRAINT "custody_events_logistics_task_id_fkey";

-- DropForeignKey
ALTER TABLE "logistics_tasks" DROP CONSTRAINT "logistics_tasks_order_id_fkey";

-- DropForeignKey
ALTER TABLE "logistics_tasks" DROP CONSTRAINT "logistics_tasks_package_id_fkey";

-- DropForeignKey
ALTER TABLE "logistics_tasks" DROP CONSTRAINT "logistics_tasks_service_point_id_fkey";

-- DropForeignKey
ALTER TABLE "logistics_tasks" DROP CONSTRAINT "logistics_tasks_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "logistics_tasks" DROP CONSTRAINT "logistics_tasks_trip_id_fkey";

-- DropForeignKey
ALTER TABLE "rental_handovers" DROP CONSTRAINT "rental_handovers_logistics_task_id_fkey";

-- DropIndex
DROP INDEX "custody_events_logistics_task_id_occurred_at_idx";

-- DropIndex
DROP INDEX "rental_handovers_logistics_task_id_key";

-- AlterTable
ALTER TABLE "custody_events" DROP COLUMN "logistics_status_after",
DROP COLUMN "logistics_status_before",
DROP COLUMN "logistics_task_id",
ADD COLUMN     "delivery_status_after" "delivery_task_status",
ADD COLUMN     "delivery_status_before" "delivery_task_status",
ADD COLUMN     "delivery_task_id" UUID;

-- AlterTable
ALTER TABLE "deposit_settlement_items" ADD COLUMN     "decision_snapshot" JSONB;

-- AlterTable
ALTER TABLE "leader_applications" DROP COLUMN "requested_type";

-- AlterTable
ALTER TABLE "leader_profiles" DROP COLUMN "leader_type";

-- AlterTable
ALTER TABLE "refunds" DROP COLUMN "refund_type",
ADD COLUMN     "purpose" "refund_purpose" NOT NULL;

-- AlterTable
ALTER TABLE "rental_handovers" DROP COLUMN "logistics_task_id",
ADD COLUMN     "delivery_task_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "rental_policies" DROP COLUMN "damage_deduction_rules",
DROP COLUMN "quantity_rules";

-- DropTable
DROP TABLE "logistics_tasks";

-- DropEnum
DROP TYPE "leader_type";

-- DropEnum
DROP TYPE "logistics_task_status";

-- DropEnum
DROP TYPE "logistics_task_type";

-- DropEnum
DROP TYPE "refund_type";

-- CreateTable
CREATE TABLE "damage_assessment_rules" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "rule_code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "severity" "damage_severity" NOT NULL,
    "deduction_type" "damage_deduction_type" NOT NULL,
    "deduction_value" DECIMAL(12,2) NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "damage_assessment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_tasks" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "service_point_id" UUID NOT NULL,
    "staff_id" UUID,
    "task_type" "delivery_task_type" NOT NULL,
    "status" "delivery_task_status" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMPTZ(6),
    "package_received_at" TIMESTAMPTZ(6),
    "recipient_verified_at" TIMESTAMPTZ(6),
    "handover_at" TIMESTAMPTZ(6),
    "returned_at" TIMESTAMPTZ(6),
    "inventory_received_at" TIMESTAMPTZ(6),
    "no_show_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_inspection_findings" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "assessed_amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "evidence_ids" JSONB,
    "rule_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_inspection_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "damage_assessment_rules_product_id_is_active_idx" ON "damage_assessment_rules"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "damage_assessment_rules_severity_idx" ON "damage_assessment_rules"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "damage_assessment_rules_product_id_rule_code_version_no_key" ON "damage_assessment_rules"("product_id", "rule_code", "version_no");

-- CreateIndex
CREATE INDEX "delivery_tasks_staff_id_status_scheduled_at_idx" ON "delivery_tasks"("staff_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "delivery_tasks_trip_id_task_type_status_idx" ON "delivery_tasks"("trip_id", "task_type", "status");

-- CreateIndex
CREATE INDEX "delivery_tasks_service_point_id_task_type_status_idx" ON "delivery_tasks"("service_point_id", "task_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_tasks_order_id_task_type_key" ON "delivery_tasks"("order_id", "task_type");

-- CreateIndex
CREATE INDEX "return_inspection_findings_inspection_id_idx" ON "return_inspection_findings"("inspection_id");

-- CreateIndex
CREATE INDEX "return_inspection_findings_rule_id_idx" ON "return_inspection_findings"("rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_inspection_findings_inspection_id_rule_id_key" ON "return_inspection_findings"("inspection_id", "rule_id");

-- CreateIndex
CREATE INDEX "custody_events_delivery_task_id_occurred_at_idx" ON "custody_events"("delivery_task_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_handovers_delivery_task_id_key" ON "rental_handovers"("delivery_task_id");

-- AddForeignKey
ALTER TABLE "damage_assessment_rules" ADD CONSTRAINT "damage_assessment_rules_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "rental_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_service_point_id_fkey" FOREIGN KEY ("service_point_id") REFERENCES "pickup_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tasks" ADD CONSTRAINT "delivery_tasks_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_handovers" ADD CONSTRAINT "rental_handovers_delivery_task_id_fkey" FOREIGN KEY ("delivery_task_id") REFERENCES "delivery_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspection_findings" ADD CONSTRAINT "return_inspection_findings_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "return_inspections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspection_findings" ADD CONSTRAINT "return_inspection_findings_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "damage_assessment_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_delivery_task_id_fkey" FOREIGN KEY ("delivery_task_id") REFERENCES "delivery_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================================
-- MANUAL BUSINESS CONSTRAINTS - TREKGO RENTAL FINAL FLOW
-- Added manually because Prisma schema cannot express all PostgreSQL CHECK/partial constraints.
-- =========================================================

-- Damage assessment rules
ALTER TABLE "damage_assessment_rules"
ADD CONSTRAINT "ck_damage_assessment_rules_deduction_value_nonnegative"
CHECK ("deduction_value" >= 0);

ALTER TABLE "damage_assessment_rules"
ADD CONSTRAINT "ck_damage_assessment_rules_percentage_range"
CHECK (
  "deduction_type" NOT IN ('PERCENT_DEPOSIT', 'PERCENT_REPLACEMENT_VALUE')
  OR ("deduction_value" >= 0 AND "deduction_value" <= 100)
);

ALTER TABLE "damage_assessment_rules"
ADD CONSTRAINT "ck_damage_assessment_rules_version_positive"
CHECK ("version_no" > 0);

ALTER TABLE "damage_assessment_rules"
ADD CONSTRAINT "ck_damage_assessment_rules_effective_window"
CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from");

-- Return inspection stage/outcome guard.
-- Delivery PRELIMINARY may classify only NORMAL / ISSUE / MISSING_PENDING_REVIEW.
-- FINAL deep review may conclude only NORMAL / DAMAGE_CONFIRMED / LOST_CONFIRMED.
ALTER TABLE "return_inspections"
ADD CONSTRAINT "ck_return_inspections_stage_outcome"
CHECK (
  ("stage" = 'PRELIMINARY' AND "outcome" IN ('NORMAL', 'ISSUE', 'MISSING_PENDING_REVIEW'))
  OR
  ("stage" = 'FINAL' AND "outcome" IN ('NORMAL', 'DAMAGE_CONFIRMED', 'LOST_CONFIRMED'))
);

-- Return inspection findings
ALTER TABLE "return_inspection_findings"
ADD CONSTRAINT "ck_return_inspection_findings_quantity_positive"
CHECK ("quantity" > 0);

ALTER TABLE "return_inspection_findings"
ADD CONSTRAINT "ck_return_inspection_findings_assessed_amount_nonnegative"
CHECK ("assessed_amount" >= 0);

-- Per-unit deposit accounting
ALTER TABLE "deposit_settlement_items"
ADD CONSTRAINT "ck_deposit_settlement_items_amounts"
CHECK (
  "deposit_amount" >= 0
  AND "deduction_amount" >= 0
  AND "refund_amount" >= 0
  AND "deduction_amount" <= "deposit_amount"
  AND "refund_amount" <= "deposit_amount"
  AND ("deduction_amount" + "refund_amount") <= "deposit_amount"
);

ALTER TABLE "deposit_settlement_items"
ADD CONSTRAINT "ck_deposit_settlement_items_settled_balance"
CHECK (
  "status" <> 'SETTLED'
  OR ("deduction_amount" + "refund_amount") = "deposit_amount"
);

-- Order-level deposit aggregate accounting
ALTER TABLE "deposit_settlements"
ADD CONSTRAINT "ck_deposit_settlements_amounts"
CHECK (
  "total_deposit" >= 0
  AND "total_deduction" >= 0
  AND "refund_amount" >= 0
  AND "total_deduction" <= "total_deposit"
  AND "refund_amount" <= "total_deposit"
  AND ("total_deduction" + "refund_amount") <= "total_deposit"
);

ALTER TABLE "deposit_settlements"
ADD CONSTRAINT "ck_deposit_settlements_settled_balance"
CHECK (
  "status" <> 'SETTLED'
  OR ("total_deduction" + "refund_amount") = "total_deposit"
);

-- Product-level reservation validity
ALTER TABLE "rental_quantity_reservations"
ADD CONSTRAINT "ck_rental_quantity_reservations_quantity_positive"
CHECK ("quantity" > 0);

ALTER TABLE "rental_quantity_reservations"
ADD CONSTRAINT "ck_rental_quantity_reservations_window"
CHECK ("occupied_from" < "occupied_until");

-- Rental line validity
ALTER TABLE "rental_quote_lines"
ADD CONSTRAINT "ck_rental_quote_lines_quantity_days_positive"
CHECK ("quantity" > 0 AND "charged_days" > 0);

ALTER TABLE "rental_order_lines"
ADD CONSTRAINT "ck_rental_order_lines_quantity_days_positive"
CHECK ("quantity" > 0 AND "charged_days" > 0);

-- Rental order time windows
ALTER TABLE "rental_orders"
ADD CONSTRAINT "ck_rental_orders_rental_window"
CHECK ("rental_start_at" < "rental_end_at");

ALTER TABLE "rental_orders"
ADD CONSTRAINT "ck_rental_orders_occupied_window"
CHECK ("occupied_start_at" < "occupied_end_at");

ALTER TABLE "rental_orders"
ADD CONSTRAINT "ck_rental_orders_occupied_contains_rental"
CHECK (
  "occupied_start_at" <= "rental_start_at"
  AND "occupied_end_at" >= "rental_end_at"
);

-- One physical EquipmentUnit cannot belong to more than one active assignment at a time.
CREATE UNIQUE INDEX "uq_rental_unit_assignments_active_equipment_unit"
ON "rental_unit_assignments" ("equipment_unit_id")
WHERE "status" IN ('ASSIGNED', 'PACKED', 'HANDED_OVER', 'RETURNED');

-- Refund source/purpose consistency.
-- Exactly one logical source must be present for every refund.
ALTER TABLE "refunds"
ADD CONSTRAINT "ck_refunds_purpose_source"
CHECK (
  (
    "purpose" = 'DEPOSIT'
    AND ("deposit_settlement_id" IS NOT NULL OR "deposit_settlement_item_id" IS NOT NULL)
    AND "booking_cancellation_id" IS NULL
    AND "rental_order_id" IS NULL
    AND "trail_access_id" IS NULL
  )
  OR
  (
    "purpose" = 'BOOKING_CANCELLATION'
    AND "booking_cancellation_id" IS NOT NULL
    AND "deposit_settlement_id" IS NULL
    AND "deposit_settlement_item_id" IS NULL
    AND "rental_order_id" IS NULL
    AND "trail_access_id" IS NULL
  )
  OR
  (
    "purpose" = 'RENTAL_CANCELLATION'
    AND "rental_order_id" IS NOT NULL
    AND "deposit_settlement_id" IS NULL
    AND "deposit_settlement_item_id" IS NULL
    AND "booking_cancellation_id" IS NULL
    AND "trail_access_id" IS NULL
  )
  OR
  (
    "purpose" = 'TRAIL_ACCESS'
    AND "trail_access_id" IS NOT NULL
    AND "deposit_settlement_id" IS NULL
    AND "deposit_settlement_item_id" IS NULL
    AND "booking_cancellation_id" IS NULL
    AND "rental_order_id" IS NULL
  )
);

ALTER TABLE "refunds"
ADD CONSTRAINT "ck_refunds_amount_positive"
CHECK ("amount" > 0);

