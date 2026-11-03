CREATE TABLE "gps_sync_states" (
  "session_id" UUID PRIMARY KEY REFERENCES "gps_sessions"("id") ON DELETE RESTRICT,
  "metadata_revision" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  "snapshot_revision" INTEGER NOT NULL DEFAULT 0,
  "processed_revision" INTEGER NOT NULL DEFAULT 0,
  "snapshot" JSONB, "lease_token" UUID, "lease_until" TIMESTAMPTZ(6),
  "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0, "last_error" VARCHAR(100),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "gps_sync_states_status_available_at_idx" ON "gps_sync_states"("status", "available_at");
CREATE TABLE "gps_sync_receipts" (
  "session_id" UUID NOT NULL REFERENCES "gps_sessions"("id") ON DELETE RESTRICT,
  "kind" VARCHAR(20) NOT NULL, "key" VARCHAR(120) NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL, "payload" JSONB NOT NULL, "response" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("session_id", "kind", "key")
);
CREATE TABLE "gps_event_consumers" (
  "instance_id" UUID PRIMARY KEY, "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "gps_event_deliveries" (
  "event_id" UUID NOT NULL REFERENCES "gps_outbox_events"("id") ON DELETE CASCADE,
  "instance_id" UUID NOT NULL, "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("event_id", "instance_id")
);
CREATE INDEX "gps_event_deliveries_processed_at_idx" ON "gps_event_deliveries"("processed_at");
CREATE TABLE "gps_socket_presences" (
  "socket_id" VARCHAR(180) PRIMARY KEY, "instance_id" UUID NOT NULL,
  "trip_id" UUID NOT NULL, "user_id" UUID NOT NULL, "expires_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX "gps_socket_presences_trip_id_user_id_expires_at_idx" ON "gps_socket_presences"("trip_id", "user_id", "expires_at");
CREATE INDEX "gps_socket_presences_expires_at_idx" ON "gps_socket_presences"("expires_at");
