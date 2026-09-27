import { LeaderTripDetail } from "@/features/leaders/components/leader/LeaderTripDetail";

export default async function LeaderTripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return <LeaderTripDetail tripId={tripId} />;
}