BEGIN;
ALTER TABLE "trip_trail_plans" ALTER COLUMN "system_trail_id" DROP NOT NULL,
  ALTER COLUMN "snapshot_difficulty" DROP NOT NULL,
  ADD COLUMN "personal_trail_id" UUID;
ALTER TABLE "trip_trail_plans" ADD CONSTRAINT "trip_trail_plans_personal_trail_id_fkey"
  FOREIGN KEY ("personal_trail_id") REFERENCES "personal_trails"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_trail_plans" ADD CONSTRAINT "trip_trail_plan_exactly_one_source"
  CHECK (num_nonnulls("system_trail_id", "personal_trail_id") = 1);
ALTER TABLE "trip_checkpoints" ADD COLUMN "source_personal_checkpoint_id" UUID;
ALTER TABLE "trip_checkpoints" ADD CONSTRAINT "trip_checkpoints_source_personal_checkpoint_id_fkey"
  FOREIGN KEY ("source_personal_checkpoint_id") REFERENCES "personal_checkpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_checkpoints" ADD CONSTRAINT "trip_checkpoint_at_most_one_source"
  CHECK (num_nonnulls("source_checkpoint_id", "source_personal_checkpoint_id") <= 1);
COMMIT;
