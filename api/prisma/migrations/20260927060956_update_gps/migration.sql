/*
  Warnings:

  - A unique constraint covering the columns `[trip_id,trip_checkpoint_id,user_id]` on the table `checkpoint_events` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[session_id,client_sample_id]` on the table `gps_locations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `client_sample_id` to the `gps_locations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trip_trail_plan_id` to the `route_deviation_events` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "checkpoint_events_trip_id_trip_checkpoint_id_user_id_idx";

-- AlterTable
ALTER TABLE "gps_locations" ADD COLUMN     "client_sample_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "route_deviation_events" ADD COLUMN     "trip_trail_plan_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "trail_recording_points" (
    "id" BIGSERIAL NOT NULL,
    "recording_id" UUID NOT NULL,
    "client_sample_id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy_m" DECIMAL(7,2),
    "speed_mps" DECIMAL(7,2),
    "heading_deg" DECIMAL(6,2),
    "altitude_m" DECIMAL(8,2),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trail_recording_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trail_recording_points_recording_id_recorded_at_idx" ON "trail_recording_points"("recording_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "trail_recording_points_recording_id_client_sample_id_key" ON "trail_recording_points"("recording_id", "client_sample_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoint_events_trip_id_trip_checkpoint_id_user_id_key" ON "checkpoint_events"("trip_id", "trip_checkpoint_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gps_locations_session_id_client_sample_id_key" ON "gps_locations"("session_id", "client_sample_id");

-- CreateIndex
CREATE INDEX "route_deviation_events_trip_trail_plan_id_start_at_idx" ON "route_deviation_events"("trip_trail_plan_id", "start_at");

-- AddForeignKey
ALTER TABLE "trail_recording_points" ADD CONSTRAINT "trail_recording_points_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "trail_recordings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_deviation_events" ADD CONSTRAINT "route_deviation_events_trip_trail_plan_id_fkey" FOREIGN KEY ("trip_trail_plan_id") REFERENCES "trip_trail_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
