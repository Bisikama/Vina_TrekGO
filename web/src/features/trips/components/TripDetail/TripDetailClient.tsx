"use client";

import { useMemo, useState } from "react";
import { TripData } from "../../data/mockTripsData";
import { TripHeader } from "./TripHeader";
import { ItineraryAccordion } from "./ItineraryAccordion";
import { ServicesAndPolicy } from "./ServicesAndPolicy";
import { TripCostBreakdown } from "./TripCostBreakdown";
import { BookingSidebar } from "./BookingSidebar";
import { TripRouteReviewMap } from "@/features/leaders/components/leader/TripRouteReviewMap";
import { SurfaceCard } from "@/components/ui";
import type { SystemTrailDetail } from "@/features/leaders/components/leader/StepTwoOverviewMap";

const stripEmojis = (text: string) =>
  text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/^[ \t]+/gm, "");

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
      totalDistance: trailDetail.distanceKm ? `${trailDetail.distanceKm} km` : trip.totalDistance,
      maxElevation: trailDetail.elevationGainM ? `+${trailDetail.elevationGainM} m` : trip.maxElevation,
      location: {
        name: trip.location.name !== "Khu vực trekking" ? trip.location.name : (trailDetail.destination?.name || trailDetail.name || trip.location.name),
        distance: trailDetail.distanceKm ? `${trailDetail.distanceKm} km` : trip.location.distance,
      },
    };
  }, [trip, trailDetail]);

  return (
    <div className="bg-[#F7F7F4] min-h-screen pb-20">
      <TripHeader trip={enrichedTrip} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content Column */}
          <div className="flex-1 lg:max-w-[700px] xl:max-w-[800px] space-y-8">
            {/* Giới thiệu & Mô tả chi tiết chuyến đi */}
            {enrichedTrip.description ? (
              <SurfaceCard as="section" padding="lg" className="rounded-2xl">
                <div className="mb-4 border-b border-gray-100 pb-3">
                  <h2 className="text-xl font-extrabold text-gray-900">
                    Giới thiệu &amp; Kế hoạch chuyến đi
                  </h2>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-7 text-gray-700 font-normal">
                  {stripEmojis(enrichedTrip.description)}
                </div>
              </SurfaceCard>
            ) : null}

            {/* Map 3D Section */}
            <SurfaceCard as="section" padding="lg" className="rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xl font-extrabold text-gray-900">
                    Bản đồ Cung đường &amp; Toạ độ GPS 3D
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Dữ liệu độ cao thực tế và các trạm Checkpoint kiểm duyệt chuẩn VFRS
                  </p>
                </div>
                {trailCode ? (
                  <span className="bg-emerald-50 text-[#125238] text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-100">
                    ● GPS 3D Ready
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-full">
                    Cung đường tự do
                  </span>
                )}
              </div>

              {trailCode ? (
                <TripRouteReviewMap
                  trailCode={trailCode}
                  onTrailLoaded={(detail) => setTrailDetail(detail as any)}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
                  <h3 className="text-sm font-bold text-slate-800">
                    Cung đường chưa có toạ độ vệ tinh 3D
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                    Chuyến đi này di chuyển theo lộ trình thực địa và sự dẫn dắt trực tiếp của Leader.
                  </p>
                </div>
              )}
            </SurfaceCard>

            {/* Checkpoints Section */}
            {enrichedTrip.checkpoints && enrichedTrip.checkpoints.length > 0 && (
              <SurfaceCard as="section" padding="lg" className="rounded-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  <h2 className="text-xl font-extrabold text-gray-900">
                    Các trạm kiểm soát (Checkpoints)
                  </h2>
                  <span className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#125238]">
                    {enrichedTrip.checkpoints.length} trạm
                  </span>
                </div>
                <div className="space-y-2.5">
                  {enrichedTrip.checkpoints.map((cp, idx) => (
                    <div
                      key={cp.id || idx}
                      className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#125238] text-xs font-bold text-white shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{cp.name}</div>
                          {cp.description && (
                            <div className="text-xs text-gray-500">{cp.description}</div>
                          )}
                        </div>
                      </div>
                      {cp.isRequired && (
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                          Bắt buộc
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </SurfaceCard>
            )}

            <ItineraryAccordion trip={enrichedTrip} />
            <TripCostBreakdown trip={enrichedTrip} />
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
