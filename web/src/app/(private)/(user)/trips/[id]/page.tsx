import { mockTripsData } from "@/features/trips/data/mockTripsData";
import { TripDetailClient } from "@/features/trips/components/TripDetail/TripDetailClient";
import { notFound } from "next/navigation";
import { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const trip = mockTripsData.find((t) => t.id === resolvedParams.id);
  
  if (!trip) {
    return {
      title: "Không tìm thấy chuyến đi",
    };
  }

  return {
    title: `${trip.title} - Trekking System`,
    description: trip.description,
  };
}

export default async function TripDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const trip = mockTripsData.find((t) => t.id === resolvedParams.id);

  if (!trip) {
    notFound();
  }

  // If the trip doesn't have detailed data yet (for mock purposes, only trip-1 has full data in our mockTripsData)
  // we could potentially show a message or just render what we have.
  // TripDetailClient handles missing optional fields gracefully.

  return <TripDetailClient trip={trip} />;
}
