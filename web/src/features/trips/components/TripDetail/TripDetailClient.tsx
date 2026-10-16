"use client";

import { useMemo, useState } from "react";
import { TripData } from "../../data/mockTripsData";
import { TripHeader } from "./TripHeader";
import { ItineraryAccordion } from "./ItineraryAccordion";
import { ServicesAndPolicy } from "./ServicesAndPolicy";
import { BookingSidebar } from "./BookingSidebar";
import { TripRouteReviewMap } from "@/features/leaders/components/leader/TripRouteReviewMap";
import type { SystemTrailDetail } from "@/features/leaders/components/leader/StepTwoOverviewMap";

export const TripDetailClient = ({
  trip,
  trailCode,
}: {
  trip: TripData;
  trailCode?: string | null;
}) => {
  const [trailDetail, setTrailDetail] = useState<SystemTrailDetail | null>(null);

  const enrichedTrip = useMemo(() => {
    if (!trailDetail) return trip;
    return {
      ...trip,
      totalDistance: `${trailDetail.distanceKm} km`,
      maxElevation: trailDetail.elevationGainM ? `${trailDetail.elevationGainM} m` : trip.maxElevation,
      location: {
        name: trailDetail.destination?.name || trailDetail.name || trip.location.name,
        distance: `${trailDetail.distanceKm} km`,
      },
      difficulty: trailDetail.difficulty
        ? {
            level: trailDetail.difficulty.toLowerCase(),
            label:
              trailDetail.difficulty === "EASY"
                ? "Dễ"
                : trailDetail.difficulty === "MEDIUM"
                ? "Trung bình"
                : "Khó",
            color:
              trailDetail.difficulty === "EASY"
                ? "bg-emerald-100 text-emerald-700"
                : trailDetail.difficulty === "MEDIUM"
                ? "bg-blue-100 text-blue-700"
                : "bg-red-100 text-red-700",
          }
        : trip.difficulty,
    };
  }, [trip, trailDetail]);

  return (
    <div className="bg-[#F7F7F4] min-h-screen pb-20">
      <TripHeader trip={enrichedTrip} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content Column */}
          <div className="flex-1 lg:max-w-[700px] xl:max-w-[800px] space-y-8">
            {/* Map 3D Section */}
            <section className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">
                    Bản đồ Cung đường & Toạ độ GPS 3D
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Dữ liệu độ cao thực tế và các trạm Checkpoint kiểm duyệt chuẩn VFRS
                  </p>
                </div>
                <span className="bg-emerald-50 text-[#125238] text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100">
                  ● GPS 3D Ready
                </span>
              </div>

              {/* Gọi API lấy toạ độ thực tế theo trailCode của trip */}
              <TripRouteReviewMap
                trailCode={trailCode || "TRAIL_BADEN_COTDIEN"}
                onTrailLoaded={(detail) => setTrailDetail(detail as any)}
              />
            </section>

            <ItineraryAccordion trip={enrichedTrip} />
            <ServicesAndPolicy trip={enrichedTrip} />
          </div>

          {/* Sidebar Column */}
          <div className="lg:w-[380px] shrink-0">
            <BookingSidebar trip={enrichedTrip} />
          </div>
        </div>
      </div>
    </div>
  );
};
