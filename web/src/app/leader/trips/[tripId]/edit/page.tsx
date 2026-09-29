import { LeaderTripEdit } from "@/features/leaders/components/leader/LeaderTripEdit";

export default async function LeaderTripEditPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;

  return <LeaderTripEdit tripId={tripId} />;
}