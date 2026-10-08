import { PublicBookingTrip } from '@/features/bookings/components/PublicBookingTrips';
export const metadata = { title: 'Chi tiết chuyến đi | TrekGo' };
export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <PublicBookingTrip tripId={(await params).id} />;
}
