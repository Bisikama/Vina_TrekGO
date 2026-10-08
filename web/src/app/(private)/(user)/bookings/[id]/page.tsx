import { BookingLayout } from "@/features/bookings/components/BookingFlow/BookingLayout";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  return <BookingLayout bookingId={(await params).id} />;
}
