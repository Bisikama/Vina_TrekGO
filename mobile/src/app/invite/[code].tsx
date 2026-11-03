import { PrivateTripInvitePreviewScreen } from "@/features/private-trips/screens";
import { useLocalSearchParams } from "expo-router";

export default function PublicInviteDeepLinkRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <PrivateTripInvitePreviewScreen inviteCode={code} />;
}
