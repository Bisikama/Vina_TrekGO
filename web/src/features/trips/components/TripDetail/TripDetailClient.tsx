"use client";

import { TripData } from "../../data/mockTripsData";
import { TripHeader } from "./TripHeader";
import { ItineraryAccordion } from "./ItineraryAccordion";
import { ServicesAndPolicy } from "./ServicesAndPolicy";
import { BookingSidebar } from "./BookingSidebar";
import { TripRouteReviewMap } from "@/features/leaders/components/leader/TripRouteReviewMap";

export const TripDetailClient = ({ trip }: { trip: TripData }) => {
  return (
    <div className="bg-[#F7F7F4] min-h-screen pb-20">
      <TripHeader trip={trip} />

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

              {/* Gọi API http://localhost:3000/api/v1/system-trails/TRAIL_BADEN_COTDIEN */}
              <TripRouteReviewMap trailCode="TRAIL_BADEN_COTDIEN" />
            </section>

            <ItineraryAccordion trip={trip} />
            <ServicesAndPolicy trip={trip} />
          </div>

          {/* Sidebar Column */}
          <div className="lg:w-[380px] shrink-0">
            <BookingSidebar trip={trip} />
          </div>
        </div>
      </div>
    </div>
  );
};
