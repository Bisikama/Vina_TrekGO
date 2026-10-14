-- DropForeignKey
ALTER TABLE "weather_snapshots" DROP CONSTRAINT "weather_snapshots_trip_id_fkey";

-- AlterTable
ALTER TABLE "weather_snapshots" ADD COLUMN     "apparent_temperature_c" DECIMAL(5,2),
ADD COLUMN     "forecast_data" JSONB,
ADD COLUMN     "precipitation_mm" DECIMAL(6,2),
ADD COLUMN     "weather_code" INTEGER,
ADD COLUMN     "wind_gust_mps" DECIMAL(7,2),
ALTER COLUMN "trip_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "weather_snapshots_latitude_longitude_observed_at_idx" ON "weather_snapshots"("latitude", "longitude", "observed_at");

-- AddForeignKey
ALTER TABLE "weather_snapshots" ADD CONSTRAINT "weather_snapshots_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
