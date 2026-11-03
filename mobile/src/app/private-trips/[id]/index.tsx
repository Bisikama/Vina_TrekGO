import { PrivateTripDetailScreen } from "@/features/private-trips/screens";
import { useLocalSearchParams } from "expo-router";

export default function PrivateTripDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrivateTripDetailScreen tripId={id} />;
}
