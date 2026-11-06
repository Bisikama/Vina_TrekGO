CREATE TABLE "rental_early_return_requests" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL REFERENCES "rental_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" VARCHAR(24) NOT NULL CHECK ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'SUPERSEDED')),
  "requested_at" TIMESTAMPTZ(6) NOT NULL,
  "requested_slot_at" TIMESTAMPTZ(6) NOT NULL,
  "confirmed_slot_at" TIMESTAMPTZ(6),
  "confirmed_by" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "confirmed_at" TIMESTAMPTZ(6),
  "task_id" UUID REFERENCES "delivery_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "previous_task_at" TIMESTAMPTZ(6),
  "superseded_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "rental_early_return_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rental_early_return_requests_order_id_status_idx" ON "rental_early_return_requests" ("order_id", "status");
CREATE INDEX "rental_early_return_requests_status_requested_at_idx" ON "rental_early_return_requests" ("status", "requested_at");
CREATE UNIQUE INDEX "rental_early_return_one_open_per_order" ON "rental_early_return_requests" ("order_id") WHERE "status" IN ('PENDING', 'CONFIRMED');
