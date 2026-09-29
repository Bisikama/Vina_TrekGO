-- CreateEnum
CREATE TYPE "media_provider" AS ENUM ('CLOUDINARY');

-- CreateEnum
CREATE TYPE "media_resource_type" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "media_status" AS ENUM ('PENDING_UPLOAD', 'PROCESSING', 'READY', 'REJECTED', 'DELETE_PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "media_scope" AS ENUM ('RENTAL_PRODUCT', 'CONDITION_EVIDENCE', 'RETURN_EVIDENCE', 'EXCEPTION_EVIDENCE');

-- CreateEnum
CREATE TYPE "media_capture_source" AS ENUM ('CAMERA', 'GALLERY', 'FILE', 'SYSTEM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "media_provenance_status" AS ENUM ('DIRECT_CAPTURE', 'METADATA_CONSISTENT', 'METADATA_MISSING', 'SUSPICIOUS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "media_c2pa_status" AS ENUM ('NOT_CHECKED', 'NOT_PRESENT', 'VERIFIED', 'INVALID', 'UNSUPPORTED');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "provider" "media_provider" NOT NULL,
    "scope" "media_scope" NOT NULL,
    "resource_type" "media_resource_type" NOT NULL,
    "status" "media_status" NOT NULL,
    "provider_asset_id" TEXT,
    "provider_public_id" TEXT,
    "delivery_type" TEXT,
    "original_file_name" TEXT,
    "mime_type" TEXT,
    "format" TEXT,
    "size_bytes" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "secure_url" TEXT,
    "sha256" TEXT,
    "perceptual_hash" TEXT,
    "capture_source" "media_capture_source" NOT NULL,
    "client_captured_at" TIMESTAMPTZ(6),
    "exif_captured_at" TIMESTAMPTZ(6),
    "exif_metadata" JSONB,
    "c2pa_status" "media_c2pa_status" NOT NULL,
    "provenance_status" "media_provenance_status" NOT NULL,
    "provenance_reasons" JSONB,
    "upload_intent_expires_at" TIMESTAMPTZ(6),
    "uploaded_at" TIMESTAMPTZ(6),
    "ready_at" TIMESTAMPTZ(6),
    "retention_until" TIMESTAMPTZ(6),
    "delete_requested_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_provider_asset_id_key" ON "media_assets"("provider_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_provider_public_id_key" ON "media_assets"("provider_public_id");

-- CreateIndex
CREATE INDEX "media_assets_owner_user_id_status_idx" ON "media_assets"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "media_assets_scope_status_idx" ON "media_assets"("scope", "status");

-- CreateIndex
CREATE INDEX "media_assets_status_retention_until_idx" ON "media_assets"("status", "retention_until");
