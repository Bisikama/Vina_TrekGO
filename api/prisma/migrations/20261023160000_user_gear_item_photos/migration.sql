-- CreateTable
CREATE TABLE "user_gear_item_photos" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "storage_ref" VARCHAR(500) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_gear_item_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_gear_item_photo_item_idx" ON "user_gear_item_photos"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_gear_item_photo_item_position_unique" ON "user_gear_item_photos"("item_id", "position");

-- AddForeignKey
ALTER TABLE "user_gear_item_photos" ADD CONSTRAINT "user_gear_item_photos_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "user_gear_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

