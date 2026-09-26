import { RentalCatalogScreen } from '@/screens/rental-catalog';

const demoBookingId = process.env.EXPO_PUBLIC_DEMO_BOOKING_ID ?? 'booking_001';

export default function HomeRoute() {
  return <RentalCatalogScreen bookingId={demoBookingId} />;
}
