-- DropForeignKey
ALTER TABLE "cancellation_deliveries" DROP CONSTRAINT "cancellation_deliveries_event_id_fkey";

-- AddForeignKey
ALTER TABLE "cancellation_deliveries" ADD CONSTRAINT "cancellation_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "booking_outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
