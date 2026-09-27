import { LeaderDetails } from "@/features/leaders/components/LeaderDetails";

export default async function LeaderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <LeaderDetails id={resolvedParams.id} />;
}
