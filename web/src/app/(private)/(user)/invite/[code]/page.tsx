import { PrivateTripInvite } from "@/features/trips/components/PrivateTripInvite";

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <PrivateTripInvite code={resolvedParams.code} />
    </div>
  );
}
