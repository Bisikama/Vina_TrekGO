"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { mockTripsData, TripData } from "@/features/trips/data/mockTripsData";
import { createdTripToTripData, readCreatedLeaderTrip } from "@/features/leaders/data/mockLeaderTripStore";
import { TripDetailClient } from "@/features/trips/components/TripDetail/TripDetailClient";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<TripData | null>(null);

  useEffect(() => {
    const refresh = () => {
      const created = readCreatedLeaderTrip();
      const dynamicTrip = created?.id === id ? createdTripToTripData(created) : null;
      setTrip(dynamicTrip || mockTripsData.find((item) => item.id === id) || null);
    };
    refresh();
    window.addEventListener("trekgo-mock-db-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("trekgo-mock-db-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [id]);

  if (!trip) return <div className="p-10 text-center">Không tìm thấy chuyến đi</div>;
  return <TripDetailClient trip={trip} />;
}
