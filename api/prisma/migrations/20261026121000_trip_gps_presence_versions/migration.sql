CREATE TABLE "gps_presence_states" (
  "trip_id" UUID NOT NULL, "user_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "location_version" INTEGER NOT NULL DEFAULT 0, "status" VARCHAR(12) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("trip_id", "user_id")
);
