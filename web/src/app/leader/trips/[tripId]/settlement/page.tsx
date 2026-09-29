import { LeaderTripSettlement } from "@/features/leaders/components/leader/LeaderTripSettlement";

export default async function LeaderTripSettlementPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return <LeaderTripSettlement tripId={tripId} />;
}