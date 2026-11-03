import { useLocalSearchParams } from 'expo-router';
import { TripShareScreen } from '@/features/trip-gps/screens/TripShareScreen';

export default function TripShareRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TripShareScreen tripId={id} />;
}
