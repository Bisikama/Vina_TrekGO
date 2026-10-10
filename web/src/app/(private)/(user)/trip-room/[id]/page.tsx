import { PrivateTripRoom } from "@/features/trips/components/PrivateTripRoom";

export default async function TripRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <PrivateTripRoom tripId={resolvedParams.id} />
    </div>
  );
}
