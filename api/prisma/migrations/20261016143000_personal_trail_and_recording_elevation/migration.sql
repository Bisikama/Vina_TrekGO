-- AlterTable
ALTER TABLE "personal_trails" ADD COLUMN     "elevation_loss_m" INTEGER,
ADD COLUMN     "elevation_profile" JSONB;

-- AlterTable
ALTER TABLE "trail_recording_points" ADD COLUMN     "accepted" BOOLEAN,
ADD COLUMN     "altitude_accuracy_m" DECIMAL(7,2),
ADD COLUMN     "reject_reason" VARCHAR(40),
ADD COLUMN     "segment_id" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "trail_recordings" ADD COLUMN     "client_recording_id" UUID,
ADD COLUMN     "elevation_loss_m" INTEGER,
ADD COLUMN     "elevation_profile" JSONB;

-- CreateIndex
CREATE INDEX "trail_recording_points_recording_id_segment_id_recorded_at_idx" ON "trail_recording_points"("recording_id", "segment_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "trail_recordings_client_recording_id_key" ON "trail_recordings"("client_recording_id");
