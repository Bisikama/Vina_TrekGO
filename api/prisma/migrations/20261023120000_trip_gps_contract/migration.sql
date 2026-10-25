BEGIN;
ALTER TABLE "route_deviation_events" ADD COLUMN "gps_managed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "gps_policies"
  ADD COLUMN "sample_interval_seconds" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "max_batch_samples" INTEGER NOT NULL DEFAULT 200,
  ADD COLUMN "live_location_max_age_seconds" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "stale_after_seconds" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "offline_after_seconds" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "recovery_threshold_m" DECIMAL(10,2) NOT NULL DEFAULT 30,
  ADD COLUMN "recovery_consecutive_samples" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "signal_gap_seconds" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "max_plausible_speed_mps" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT "gps_full_policy_limits" CHECK (
    "sample_interval_seconds" > 0 AND "max_batch_samples" BETWEEN 1 AND 10000
    AND "live_location_max_age_seconds" > 0 AND "stale_after_seconds" > 0
    AND "offline_after_seconds" >= "stale_after_seconds" AND "signal_gap_seconds" > 0
    AND "recovery_threshold_m" >= 0 AND "recovery_consecutive_samples" > 0
    AND "max_plausible_speed_mps" >= 0);
CREATE TABLE "trip_gps_projections" (
  "trip_id" UUID PRIMARY KEY REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "data" JSONB NOT NULL, "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "gps_start_receipts" (
  "user_id" UUID NOT NULL, "client_session_id" UUID NOT NULL, "trip_id" UUID NOT NULL,
  "device_id" VARCHAR(180) NOT NULL,
  "session_id" UUID NOT NULL REFERENCES "gps_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("user_id", "client_session_id")
);
CREATE INDEX "gps_start_receipts_session_id_idx" ON "gps_start_receipts"("session_id");
-- Upgrade the previously deployed three-field policy snapshots without changing
-- intervals, command receipts, owners or geometry. Preserve the frozen thresholds.
UPDATE "gps_sessions" s SET "recording_state" = jsonb_set(s."recording_state", '{policy}',
  jsonb_build_object(
    'id', p.id, 'versionNo', p.version_no,
    'sampleIntervalSeconds', p.sample_interval_seconds, 'syncIntervalSeconds', p.sync_interval_seconds,
    'maxBatchSamples', p.max_batch_samples,
    'maxAcceptedAccuracyM', COALESCE((s.recording_state->'policy'->>'maxAcceptedAccuracyM')::numeric, p.max_accepted_accuracy_m, 50),
    'maxFutureSkewSeconds', COALESCE((s.recording_state->'policy'->>'maxFutureSkewSeconds')::integer, p.max_future_skew_seconds),
    'lateSyncGraceSeconds', COALESCE((s.recording_state->'policy'->>'lateSyncGraceSeconds')::integer, p.late_sync_grace_seconds),
    'liveLocationMaxAgeSeconds', p.live_location_max_age_seconds, 'staleAfterSeconds', p.stale_after_seconds,
    'offlineAfterSeconds', p.offline_after_seconds, 'deviationThresholdM', p.deviation_threshold_m,
    'deviationConsecutiveSamples', p.deviation_consecutive_samples, 'recoveryThresholdM', p.recovery_threshold_m,
    'recoveryConsecutiveSamples', p.recovery_consecutive_samples, 'signalGapSeconds', p.signal_gap_seconds,
    'defaultCheckpointRadiusM', p.default_checkpoint_radius_m, 'rawLocationRetentionDays', p.raw_location_retention_days,
    'maxPlausibleSpeedMps', p.max_plausible_speed_mps))
FROM "gps_policies" p WHERE s.gps_policy_id = p.id AND s.recording_state IS NOT NULL;
INSERT INTO "gps_start_receipts" ("user_id", "client_session_id", "trip_id", "device_id", "session_id")
SELECT "user_id", "client_session_id", "trip_id", "device_id", "id" FROM "gps_sessions"
WHERE "client_session_id" IS NOT NULL AND "device_id" IS NOT NULL;
-- Refuse conflicting legacy sessions rather than stopping or deleting users' recordings.
CREATE UNIQUE INDEX "uq_gps_sessions_open_user" ON "gps_sessions"("user_id")
WHERE "status" IN ('ACTIVE', 'PAUSED');
COMMIT;
