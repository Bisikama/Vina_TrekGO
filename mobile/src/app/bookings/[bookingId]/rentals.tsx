import { useLocalSearchParams } from 'expo-router';

import { RentalCatalogScreen } from '@/screens/rental-catalog';

export default function RentalCatalogRoute() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const resolvedBookingId = Array.isArray(bookingId) ? bookingId[0] : bookingId;

  return <RentalCatalogScreen bookingId={resolvedBookingId ?? ''} />;
}
