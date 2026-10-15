import { Suspense } from "react";
import { BookingLayout } from "@/features/bookings/components/BookingFlow/BookingLayout";
import { BookingCheckout } from "@/features/bookings/components/BookingCheckout";
import { PublicBookingTrip } from "@/features/bookings/components/PublicBookingTrips";

export default async function BookingPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ participants?: string }>;
}) {
  const { id } = await params;
  const { participants } = await searchParams;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    // The existing trip CTA passes a trip ID plus participants; persisted
    // booking links carry only the booking ID.
    if (participants !== undefined) return <PublicBookingTrip tripId={id} participantCount={Math.max(1, Math.min(100, Math.floor(Number(participants) || 1)))} />;
    return <BookingCheckout bookingId={id} />;
  }
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7F7F4]">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
        </div>
      }
    >
      <BookingLayout />
    </Suspense>
  );
}
