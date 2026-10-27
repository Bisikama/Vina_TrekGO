-- DropForeignKey
ALTER TABLE "booking_notification_receipts" DROP CONSTRAINT "booking_notification_receipts_event_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_participant_invitations" DROP CONSTRAINT "booking_participant_invitations_booking_participant_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_participant_invitations" DROP CONSTRAINT "booking_participant_invitations_recipient_user_id_fkey";

-- DropForeignKey
ALTER TABLE "booking_participant_invitations" DROP CONSTRAINT "booking_participant_invitations_sender_user_id_fkey";

-- DropForeignKey
ALTER TABLE "gps_event_deliveries" DROP CONSTRAINT "gps_event_deliveries_event_id_fkey";

-- DropForeignKey
ALTER TABLE "gps_sync_receipts" DROP CONSTRAINT "gps_sync_receipts_session_id_fkey";

-- DropForeignKey
ALTER TABLE "gps_sync_states" DROP CONSTRAINT "gps_sync_states_session_id_fkey";

-- AlterTable
ALTER TABLE "gps_presence_states" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "gps_sync_states" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "trip_cost_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "trip_cost_plans" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "trip_cost_step_tiers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "trip_gps_projections" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "trip_pricing_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "booking_participant_invitations" ADD CONSTRAINT "booking_participant_invitations_booking_participant_id_fkey" FOREIGN KEY ("booking_participant_id") REFERENCES "booking_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participant_invitations" ADD CONSTRAINT "booking_participant_invitations_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participant_invitations" ADD CONSTRAINT "booking_participant_invitations_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_notification_receipts" ADD CONSTRAINT "booking_notification_receipts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "booking_outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_sync_states" ADD CONSTRAINT "gps_sync_states_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gps_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_sync_receipts" ADD CONSTRAINT "gps_sync_receipts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "gps_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_event_deliveries" ADD CONSTRAINT "gps_event_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "gps_outbox_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
