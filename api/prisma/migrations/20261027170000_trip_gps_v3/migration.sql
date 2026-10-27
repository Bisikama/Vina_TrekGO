-- Additive only. Legacy sessions and history remain untouched.
ALTER TABLE gps_policies ADD COLUMN offline_access_grace_seconds INTEGER NOT NULL DEFAULT 172800
  CHECK (offline_access_grace_seconds >= 0);
CREATE TABLE gps_v3_geometries (
 hash VARCHAR(64) PRIMARY KEY, geometry JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE gps_v3_packages (
 id UUID PRIMARY KEY, trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
 hash VARCHAR(64) NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(trip_id, hash)
);
CREATE TABLE gps_v3_grants (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
 package_id UUID NOT NULL REFERENCES gps_v3_packages(id) ON DELETE RESTRICT,
 claims JSONB NOT NULL, signature TEXT NOT NULL, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX gps_v3_grants_user_id_trip_id_idx ON gps_v3_grants(user_id, trip_id);
CREATE TABLE gps_v3_recordings (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT, local_session_id UUID NOT NULL,
 package_id UUID NOT NULL REFERENCES gps_v3_packages(id) ON DELETE RESTRICT,
 grant_id UUID NOT NULL REFERENCES gps_v3_grants(id) ON DELETE RESTRICT,
 payload_hash VARCHAR(64) NOT NULL, metadata JSONB NOT NULL,
 status VARCHAR(32) NOT NULL DEFAULT 'RECEIVING' CHECK (status IN ('RECEIVING','FINALIZE_PENDING','PROCESSING','COMPLETE','NEEDS_ATTENTION')),
 result JSONB, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id, local_session_id)
);
CREATE INDEX gps_v3_recordings_trip_id_user_id_created_at_idx ON gps_v3_recordings(trip_id,user_id,created_at);
CREATE INDEX gps_v3_recordings_status_available_at_idx ON gps_v3_recordings(status,available_at);
CREATE TABLE gps_v3_parts (
 recording_id UUID NOT NULL REFERENCES gps_v3_recordings(id) ON DELETE RESTRICT,
 kind VARCHAR(12) NOT NULL CHECK (kind IN ('batch','manifest')), key VARCHAR(64) NOT NULL,
 hash VARCHAR(64) NOT NULL, payload JSONB NOT NULL, PRIMARY KEY(recording_id,kind,key)
);
CREATE TABLE gps_v3_locations (
 trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT, user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 stream_id UUID NOT NULL, sequence INTEGER NOT NULL CHECK(sequence > 0), event_id UUID NOT NULL,
 payload JSONB NOT NULL, received_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(trip_id,user_id)
);
CREATE INDEX gps_v3_locations_expires_at_idx ON gps_v3_locations(expires_at);
