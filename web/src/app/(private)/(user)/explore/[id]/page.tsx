import { SystemTrailDetailView } from "@/features/routes/components/SystemTrailDetailView";
import { SystemTrail } from "@/features/routes/services/system-trails.api";
import { notFound } from "next/navigation";

async function fetchTrailDetail(id: string): Promise<SystemTrail | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${apiUrl}/api/v1/system-trails/${id}`, { 
      cache: 'no-store' 
    });
    
    if (!res.ok) {
      return null;
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Error fetching system trail detail:", error);
    return null;
  }
}

export default async function ExploreDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const trail = await fetchTrailDetail(id);

  if (!trail) {
    notFound();
  }

  return <SystemTrailDetailView trail={trail} />;
}
