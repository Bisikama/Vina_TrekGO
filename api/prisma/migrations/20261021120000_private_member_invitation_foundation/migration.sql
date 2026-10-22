BEGIN;
-- Additive foundation; existing link invitations and memberships are unchanged.
-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "private_trip_member_invitations" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "recipient_email_snapshot" VARCHAR(255) NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "responded_at" TIMESTAMPTZ(6),
    "invalidated_at" TIMESTAMPTZ(6),
    "reason" VARCHAR(100),
    "accepted_member_id" UUID,
    "membership_version_at_accept" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_trip_member_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private_invitation_rate_buckets" (
    "actor_id" UUID NOT NULL,
    "bucket" VARCHAR(32) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resets_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "private_invitation_rate_buckets_pkey" PRIMARY KEY ("actor_id","bucket")
);

-- CreateIndex
CREATE INDEX "private_member_invitation_recipient_idx" ON "private_trip_member_invitations"("recipient_user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "private_member_invitation_sender_idx" ON "private_trip_member_invitations"("sender_user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "private_member_invitation_expiry_idx" ON "private_trip_member_invitations"("status", "expires_at");

-- CreateIndex
CREATE INDEX "private_member_invitation_trip_idx" ON "private_trip_member_invitations"("trip_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "private_member_invitation_member_idx" ON "private_trip_member_invitations"("accepted_member_id");

-- CreateIndex
CREATE INDEX "private_invitation_rate_buckets_resets_at_idx" ON "private_invitation_rate_buckets"("resets_at");

-- AddForeignKey
ALTER TABLE "private_trip_member_invitations" ADD CONSTRAINT "private_trip_member_invitations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_trip_member_invitations" ADD CONSTRAINT "private_trip_member_invitations_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_trip_member_invitations" ADD CONSTRAINT "private_trip_member_invitations_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private_trip_member_invitations" ADD CONSTRAINT "private_trip_member_invitations_accepted_member_id_fkey" FOREIGN KEY ("accepted_member_id") REFERENCES "trip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "private_member_invitation_one_pending"
ON "private_trip_member_invitations"("trip_id", "recipient_user_id") WHERE "status" = 'PENDING';

ALTER TABLE "private_trip_member_invitations"
  ADD CONSTRAINT "private_member_invitation_positive_version" CHECK ("version" > 0),
  ADD CONSTRAINT "private_member_invitation_different_users" CHECK ("sender_user_id" <> "recipient_user_id"),
  ADD CONSTRAINT "private_member_invitation_acceptance_snapshot" CHECK (
    ("status" = 'ACCEPTED' AND "accepted_member_id" IS NOT NULL AND "membership_version_at_accept" IS NOT NULL AND "membership_version_at_accept" > 0 AND "responded_at" IS NOT NULL)
    OR ("status" <> 'ACCEPTED' AND "accepted_member_id" IS NULL AND "membership_version_at_accept" IS NULL)
  );
ALTER TABLE "private_invitation_rate_buckets"
  ADD CONSTRAINT "private_invitation_rate_nonnegative" CHECK ("count" >= 0);
COMMIT;
