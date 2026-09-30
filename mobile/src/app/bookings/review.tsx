import { useLocalSearchParams } from 'expo-router';

import { BookingReviewScreen } from '@/screens/booking-review';

export default function BookingReviewRoute() {
  const { tripId } = useLocalSearchParams<{
    tripId?: string | string[];
  }>();

  const selectedTripId = Array.isArray(tripId)
    ? tripId[0]
    : tripId;

  return (
    <BookingReviewScreen
      tripId={selectedTripId ?? 'trip_fansipan_oct'}
    />
  );
}