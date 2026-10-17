BEGIN;

ALTER TABLE "trip_actual_routes" ADD COLUMN "user_id" UUID;

-- Preserve existing routes and derive ownership only from a matching GPS session.
UPDATE "trip_actual_routes" AS route
SET "user_id" = session."user_id"
FROM "gps_sessions" AS session
WHERE route."source_session_id" = session."id"
  AND route."trip_id" = session."trip_id";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "trip_actual_routes" WHERE "user_id" IS NULL) THEN
        RAISE EXCEPTION 'Cannot determine user_id for existing trip actual routes. Assign a matching source GPS session before retrying this migration.';
    END IF;
END $$;

ALTER TABLE "trip_actual_routes" ALTER COLUMN "user_id" SET NOT NULL;
DROP INDEX "trip_actual_routes_trip_id_key";
CREATE UNIQUE INDEX "trip_actual_routes_trip_id_user_id_key" ON "trip_actual_routes"("trip_id", "user_id");
CREATE INDEX "trip_actual_routes_user_id_idx" ON "trip_actual_routes"("user_id");
ALTER TABLE "trip_actual_routes" ADD CONSTRAINT "trip_actual_routes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
