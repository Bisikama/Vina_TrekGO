-- AlterTable
ALTER TABLE "personal_trails" ADD COLUMN IF NOT EXISTS "duration" VARCHAR(100);

-- AlterTable
ALTER TABLE "trail_recordings" ADD COLUMN IF NOT EXISTS "duration" VARCHAR(100),
ADD COLUMN IF NOT EXISTS "elapsed_seconds" INTEGER;
