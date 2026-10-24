import { ExploreHero } from "@/features/routes/components/ExploreHero";
import { SystemTrailList } from "@/features/routes/components/SystemTrailList";
import { PaginatedSystemTrails } from "@/features/routes/services/system-trails.api";

export const dynamic = 'force-dynamic';

// This is a Server Component, it runs on the server and fetches data directly
async function fetchTrails() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${apiUrl}/api/v1/system-trails?page=1&pageSize=20`, { 
      // Next.js caching, 'no-store' ensures it fetches fresh data on every request
      // If we want it to be cached for some time, we could use { next: { revalidate: 60 } }
      cache: 'no-store' 
    });
    
    if (!res.ok) {
      console.error("Failed to fetch trails, status:", res.status);
      return [];
    }
    
    const data: PaginatedSystemTrails = await res.json();
    return data.items || [];
  } catch (error) {
    console.error("Error fetching system trails:", error);
    return [];
  }
}

export default async function ExplorePage() {
  const trails = await fetchTrails();

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <ExploreHero />
      <SystemTrailList initialTrails={trails} />
    </div>
  );
}
