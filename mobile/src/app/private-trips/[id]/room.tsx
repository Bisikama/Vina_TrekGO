import { PrivateTripRoomScreen } from "@/features/private-trips/screens";
import { useLocalSearchParams } from "expo-router";

export default function PrivateTripRoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrivateTripRoomScreen tripId={id} />;
}
