-- Undo only 20261027170000_trip_gps_v3. Legacy GPS data is preserved.
-- WARNING: all data in the six GPS V3 tables and the added policy column is removed.
-- No CASCADE: unexpected dependencies must fail instead of deleting other objects.
BEGIN;

DROP TABLE IF EXISTS gps_v3_parts;
DROP TABLE IF EXISTS gps_v3_recordings;
DROP TABLE IF EXISTS gps_v3_locations;
DROP TABLE IF EXISTS gps_v3_grants;
DROP TABLE IF EXISTS gps_v3_packages;
DROP TABLE IF EXISTS gps_v3_geometries;

ALTER TABLE gps_policies DROP COLUMN IF EXISTS offline_access_grace_seconds;

COMMIT;
