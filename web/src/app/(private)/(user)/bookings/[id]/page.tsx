import { BookingLayout } from "@/features/bookings/components/BookingFlow/BookingLayout";

export default function BookingPage({ params }: { params: { id: string } }) {
  return <BookingLayout />;
}
