-- Additive CF01 migration. Existing PUBLIC/PRIVATE rows are intentionally not backfilled.
-- No Rental/GPS tables or existing migration history are modified.
ALTER TABLE "trips" ADD COLUMN "pickup_point_id" UUID;
CREATE INDEX "trips_pickup_point_id_idx" ON "trips"("pickup_point_id");
ALTER TABLE "trips" ADD CONSTRAINT "trips_pickup_point_id_fkey"
  FOREIGN KEY ("pickup_point_id") REFERENCES "pickup_points"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_trail_plans" ADD COLUMN "source_trail_version" INTEGER,
  ADD COLUMN "snapshot_checkpoint_ids" JSONB;
ALTER TABLE "trip_cancellation_requests" ADD COLUMN "previous_trip_status" "trip_status";
