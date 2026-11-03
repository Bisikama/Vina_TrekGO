-- A user may have multiple rentals for one trip after each prior checkout is paid.
-- Keep the database-level race-condition guard for the one unfinished checkout.
DROP INDEX IF EXISTS "uq_rental_order_user_trip_open";

CREATE UNIQUE INDEX "uq_rental_order_user_trip_open"
  ON "rental_orders" ("user_id", "trip_id")
  WHERE "status" = 'PENDING_PAYMENT';
