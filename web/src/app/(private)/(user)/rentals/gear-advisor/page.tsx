import { GearAdvisorPage } from "@/features/rentals/components/GearAdvisorPage";

export default async function GearAdvisorRoute({
  searchParams,
}: {
  searchParams: Promise<{ tripId?: string }>;
}) {
  const { tripId } = await searchParams;
  return <GearAdvisorPage initialTripId={tripId} />;
}
