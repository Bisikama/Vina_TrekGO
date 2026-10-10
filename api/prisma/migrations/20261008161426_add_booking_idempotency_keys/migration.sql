-- DropForeignKey
ALTER TABLE "rental_extension_lines" DROP CONSTRAINT "rental_extension_lines_extension_id_fkey";

-- DropForeignKey
ALTER TABLE "rental_extension_lines" DROP CONSTRAINT "rental_extension_lines_order_line_id_fkey";

-- DropForeignKey
ALTER TABLE "rental_extension_requests" DROP CONSTRAINT "rental_extension_requests_order_id_fkey";

-- DropForeignKey
ALTER TABLE "rental_orders" DROP CONSTRAINT "rental_orders_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "rental_quotes" DROP CONSTRAINT "rental_quotes_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "return_custody_transfers" DROP CONSTRAINT "return_custody_transfers_delivery_task_id_fkey";

-- DropForeignKey
ALTER TABLE "return_custody_transfers" DROP CONSTRAINT "return_custody_transfers_from_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "return_custody_transfers" DROP CONSTRAINT "return_custody_transfers_inventory_location_id_fkey";

-- DropForeignKey
ALTER TABLE "return_custody_transfers" DROP CONSTRAINT "return_custody_transfers_order_id_fkey";

-- DropIndex
DROP INDEX "deposit_settlement_items_settlement_id_status_idx";

-- DropIndex
DROP INDEX "rental_orders_status_planned_return_at_idx";

-- DropIndex
DROP INDEX "rental_pickup_codes_order_verification_idx";

-- DropIndex
DROP INDEX "return_inspections_order_id_stage_outcome_idx";

-- AlterTable
ALTER TABLE "custody_transfers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "idempotency_records" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rental_extension_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rental_extension_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rental_inbox_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "return_custody_transfers" ALTER COLUMN "id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "return_custody_transfers_from_staff_id_status_idx" ON "return_custody_transfers"("from_staff_id", "status");

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extension_requests" ADD CONSTRAINT "rental_extension_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extension_lines" ADD CONSTRAINT "rental_extension_lines_extension_id_fkey" FOREIGN KEY ("extension_id") REFERENCES "rental_extension_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "payment_allocations_payment_id_rental_order_line_id_component_k" RENAME TO "payment_allocations_payment_id_rental_order_line_id_compone_key";
