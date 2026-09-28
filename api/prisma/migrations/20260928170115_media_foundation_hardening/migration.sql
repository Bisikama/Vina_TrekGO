-- AlterTable
ALTER TABLE "media_assets" ALTER COLUMN "status" SET DEFAULT 'PENDING_UPLOAD',
ALTER COLUMN "capture_source" SET DEFAULT 'UNKNOWN',
ALTER COLUMN "c2pa_status" SET DEFAULT 'NOT_CHECKED',
ALTER COLUMN "provenance_status" SET DEFAULT 'UNKNOWN';

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
