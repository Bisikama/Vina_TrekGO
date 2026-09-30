import { useLocalSearchParams } from 'expo-router';

import { TripDetailScreen } from '@/screens/trip-detail';

export default function TripDetailRoute() {
  const { id } = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const tripId = Array.isArray(id)
    ? id[0]
    : id;

  return (
    <TripDetailScreen
      tripId={tripId ?? 'trip_fansipan_oct'}
    />
  );
}