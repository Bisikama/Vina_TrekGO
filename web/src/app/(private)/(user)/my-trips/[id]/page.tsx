import React from "react";
import { Metadata } from "next";
import { PrivateTripDetailClient } from "@/features/trips/components/PrivateTripDetail";
import { cookies } from "next/headers";

async function getPrivateTripOnServer(id: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("vina_trekgo_access_token")?.value;
  
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/v1/private-trips/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  
  if (!res.ok) {
    return null;
  }
  const trip = await res.json();

  let pickups: any[] = [];
  if (trip.destinationId) {
    try {
      const pickupRes = await fetch(`${baseUrl}/api/v1/private-trip-options/pickup-points?destinationId=${trip.destinationId}&page=1`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (pickupRes.ok) {
        pickups = await pickupRes.json();
      }
    } catch (e) {}
  }

  return { trip, pickups };
}

export const metadata: Metadata = {
  title: "Chi Tiết Chuyến Đi | Vina TrekGO",
  description: "Chi tiết chuyến đi trekking của bạn",
};

export default async function PrivateTripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const data = await getPrivateTripOnServer(resolvedParams.id);

  return (
    <div className="min-h-screen bg-gray-50 pt-8 pb-12">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
        <PrivateTripDetailClient initialTrip={data?.trip} initialPickups={data?.pickups} />
      </div>
    </div>
  );
}
