"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { TripData } from "@/features/trips/data/mockTripsData";
import { TripDetailClient } from "@/features/trips/components/TripDetail/TripDetailClient";
import { usePublicTripDetail } from "@/features/trips/hooks/usePublicTripDetail";
import type { PublicTripItem } from "@/features/trips/types/public-trips";

function publicTripToTripData(trip: PublicTripItem): TripData {
  const startAt = new Date(trip.startAt);
  const endAt = new Date(trip.endAt);
  const startDay = startAt.getDate().toString().padStart(2, "0");
  const endDay = endAt.getDate().toString().padStart(2, "0");
  const year = startAt.getFullYear().toString();
  const duration = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24)));
  
  return {
    id: trip.id,
    duration: `${duration} ngày`,
    difficulty: { level: "medium", label: "Trung bình", color: "bg-blue-100 text-blue-700" },
    isVFRSVerified: true,
    location: { name: "Khu vực leo núi", distance: "Cung đường thực tế" },
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=500&auto=format&fit=crop",
    date: { start: startDay, end: endDay, year },
    status: { label: trip.status === 'OPEN' ? 'Đang mở đăng ký' : trip.status, color: "text-emerald-600" },
    title: trip.title,
    description: trip.description || "Chuyến đi tuyệt vời cùng Vina TrekGO",
    leader: { name: "Leader", avatar: "/images/avatars/avatar-1.png", badge: "WFA Certified", experience: "Kinh nghiệm chuyên nghiệp", rating: 5, totalTrips: 10, porters: 0 },
    slots: { booked: 0, total: trip.capacity || 15, statusText: "Còn chỗ" },
    price: Number(trip.price) || 0,
    action: { label: "Xem chi tiết", variant: "primary" as const },
  };
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { trip: publicTrip, isLoading, error } = usePublicTripDetail({ tripId: id });

  const trip = useMemo(() => {
    if (!publicTrip) return null;
    return publicTripToTripData(publicTrip);
  }, [publicTrip]);

  if (isLoading) return <div className="p-10 text-center">Đang tải chuyến đi...</div>;
  if (error || !trip) return <div className="p-10 text-center">Không tìm thấy chuyến đi</div>;
  
  return <TripDetailClient trip={trip} />;
}
