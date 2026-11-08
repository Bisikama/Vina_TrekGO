-- Additive gallery. No existing trip/media rows are changed.
ALTER TYPE "media_scope" ADD VALUE IF NOT EXISTS 'PUBLIC_TRIP';

CREATE TABLE "public_trip_images" (
  "trip_id" UUID NOT NULL,
  "media_asset_id" UUID NOT NULL,
  "position" INTEGER NOT NULL CHECK ("position" BETWEEN 1 AND 10),
  CONSTRAINT "public_trip_images_pkey" PRIMARY KEY ("trip_id", "media_asset_id"),
  CONSTRAINT "public_trip_images_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "public_trip_images_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "public_trip_images_trip_id_position_key" ON "public_trip_images"("trip_id", "position");
CREATE INDEX "public_trip_images_media_asset_id_idx" ON "public_trip_images"("media_asset_id");

-- Gallery writes lock media_assets before attaching. A stale deletion/cleanup
-- reference check must still fail before any physical Cloudinary deletion.
CREATE FUNCTION cf01_preserve_gallery_media() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('DELETE_PENDING', 'DELETED') AND EXISTS
    (SELECT 1 FROM public_trip_images WHERE media_asset_id = OLD.id) THEN
    RAISE EXCEPTION 'CF01: public trip image is retained' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cf01_preserve_gallery_media BEFORE UPDATE OF status ON media_assets
  FOR EACH ROW EXECUTE FUNCTION cf01_preserve_gallery_media();
