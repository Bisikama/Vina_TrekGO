ALTER TABLE "gps_sessions"
  ADD COLUMN "client_session_id" UUID,
  ADD COLUMN "upload_deadline" TIMESTAMPTZ(6),
  ADD COLUMN "recording_state" JSONB;
ALTER TABLE "gps_policies"
  ADD COLUMN "max_future_skew_seconds" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "late_sync_grace_seconds" INTEGER NOT NULL DEFAULT 86400,
  ADD CONSTRAINT "gps_policy_recording_limits" CHECK ("max_future_skew_seconds" >= 0 AND "late_sync_grace_seconds" >= 0);
CREATE UNIQUE INDEX "gps_sessions_user_id_client_session_id_key"
  ON "gps_sessions"("user_id", "client_session_id");
ALTER TABLE "trip_actual_routes"
  ADD COLUMN "result_status" VARCHAR(20) NOT NULL DEFAULT 'READY',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "point_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "metadata" JSONB;
-- Existing routes remain intact; derive count only for existing LineStrings.
UPDATE "trip_actual_routes" SET "point_count" = jsonb_array_length("route_geojson"::jsonb->'coordinates')
WHERE "route_geojson"::jsonb->>'type' = 'LineString'
  AND jsonb_typeof("route_geojson"::jsonb->'coordinates') = 'array';
