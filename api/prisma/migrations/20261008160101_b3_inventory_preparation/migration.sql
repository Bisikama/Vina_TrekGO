-- B3 warehouse preparation foundation (RB-API-301..311).
-- Additive to B1/B2: exact EquipmentUnit assignment starts only after payment.

-- 1) A physical unit may have historical assignments, but only one active assignment.
CREATE UNIQUE INDEX "uq_rental_unit_assignment_active_unit"
ON "rental_unit_assignments" ("equipment_unit_id")
WHERE "status" IN ('ASSIGNED', 'PACKED', 'HANDED_OVER');

-- 2) API 309 creates a pending custody transfer request. Physical custody stays
-- at Inventory until Delivery confirms receipt in B4 / RB-API-402.
CREATE TYPE "custody_transfer_status" AS ENUM (
  'PENDING_RECEIPT',
  'RECEIVED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TABLE "custody_transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "package_id" UUID NOT NULL,
  "inventory_task_id" UUID NOT NULL,
  "delivery_task_id" UUID NOT NULL,
  "from_inventory_location_id" UUID NOT NULL,
  "from_staff_id" UUID NOT NULL,
  "to_staff_id" UUID NOT NULL,
  "status" "custody_transfer_status" NOT NULL DEFAULT 'PENDING_RECEIPT',
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "received_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custody_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "custody_transfers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custody_transfers_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custody_transfers_inventory_task_id_fkey" FOREIGN KEY ("inventory_task_id") REFERENCES "inventory_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custody_transfers_delivery_task_id_fkey" FOREIGN KEY ("delivery_task_id") REFERENCES "delivery_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custody_transfers_from_inventory_location_id_fkey" FOREIGN KEY ("from_inventory_location_id") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custody_transfers_from_staff_id_fkey" FOREIGN KEY ("from_staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "custody_transfers_to_staff_id_fkey" FOREIGN KEY ("to_staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "custody_transfers_status_requested_at_idx"
ON "custody_transfers" ("status", "requested_at");

CREATE INDEX "custody_transfers_delivery_task_id_status_idx"
ON "custody_transfers" ("delivery_task_id", "status");

CREATE INDEX "custody_transfers_to_staff_id_status_idx"
ON "custody_transfers" ("to_staff_id", "status");

CREATE INDEX "custody_transfers_order_id_requested_at_idx"
ON "custody_transfers" ("order_id", "requested_at");

-- Only one outbound pending receipt request may exist for a package at a time.
CREATE UNIQUE INDEX "uq_custody_transfer_package_pending"
ON "custody_transfers" ("package_id")
WHERE "status" = 'PENDING_RECEIPT';
