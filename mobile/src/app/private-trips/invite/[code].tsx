import { PrivateTripInvitePreviewScreen } from "@/features/private-trips/screens";
import { useLocalSearchParams } from "expo-router";

export default function PrivateTripInviteRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <PrivateTripInvitePreviewScreen inviteCode={code} />;
}
