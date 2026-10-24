-- AlterTable
ALTER TABLE "trips"
ADD COLUMN "registration_open_at" TIMESTAMPTZ(6),
ADD COLUMN "registration_deadline_at" TIMESTAMPTZ(6),
ADD COLUMN "closed_at" TIMESTAMPTZ(6);
