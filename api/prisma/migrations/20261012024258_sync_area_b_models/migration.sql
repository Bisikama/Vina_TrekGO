-- DropForeignKey
ALTER TABLE "deposit_refund_item_allocations" DROP CONSTRAINT "deposit_refund_item_allocations_deposit_settlement_item_id_fkey";

-- DropForeignKey
ALTER TABLE "deposit_refund_item_allocations" DROP CONSTRAINT "deposit_refund_item_allocations_refund_id_fkey";

-- DropForeignKey
ALTER TABLE "return_inspection_tasks" DROP CONSTRAINT "return_inspection_tasks_assignment_id_fkey";

-- DropForeignKey
ALTER TABLE "return_inspection_tasks" DROP CONSTRAINT "return_inspection_tasks_inventory_location_id_fkey";

-- DropForeignKey
ALTER TABLE "return_inspection_tasks" DROP CONSTRAINT "return_inspection_tasks_order_id_fkey";

-- DropForeignKey
ALTER TABLE "return_inspection_tasks" DROP CONSTRAINT "return_inspection_tasks_unit_id_fkey";

-- AlterTable
ALTER TABLE "deposit_refund_item_allocations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "return_inspection_tasks" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "return_inspection_tasks" ADD CONSTRAINT "return_inspection_tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspection_tasks" ADD CONSTRAINT "return_inspection_tasks_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "rental_unit_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspection_tasks" ADD CONSTRAINT "return_inspection_tasks_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "equipment_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_inspection_tasks" ADD CONSTRAINT "return_inspection_tasks_inventory_location_id_fkey" FOREIGN KEY ("inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_refund_item_allocations" ADD CONSTRAINT "deposit_refund_item_allocations_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_refund_item_allocations" ADD CONSTRAINT "deposit_refund_item_allocations_deposit_settlement_item_id_fkey" FOREIGN KEY ("deposit_settlement_item_id") REFERENCES "deposit_settlement_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "deposit_refund_item_allocatio_refund_id_deposit_settlement__key" RENAME TO "deposit_refund_item_allocations_refund_id_deposit_settlemen_key";

-- RenameIndex
ALTER INDEX "rental_exception_cases_status_admin_approval_due_at_admin_sla_b" RENAME TO "rental_exception_cases_status_admin_approval_due_at_admin_s_idx";

-- RenameIndex
ALTER INDEX "return_custody_transfers_status_transfer_watch_at_delayed_at_id" RENAME TO "return_custody_transfers_status_transfer_watch_at_delayed_a_idx";

-- RenameIndex
ALTER INDEX "return_inspection_tasks_inventory_location_id_status_inspection" RENAME TO "return_inspection_tasks_inventory_location_id_status_inspec_idx";
