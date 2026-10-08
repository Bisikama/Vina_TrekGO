"use client";

import React from "react";
import Image from "next/image";
import { TripData } from "@/features/trips/data/mockTripsData";

interface BookingSidebarProps {
  participants?: number;
  trip?: TripData | null;
  equipmentCost?: number;
}

export const BookingSidebar = ({
  participants = 1,
  trip,
  equipmentCost = 0,
}: BookingSidebarProps) => {
  const memberCount = Math.max(1, participants);
  const unitPrice = trip?.price || 2850000;
  const baseTripCost = unitPrice * memberCount;
  const vat = Math.round(baseTripCost * 0.08);
  const grandTotal = baseTripCost + vat + equipmentCost;

  const tripTitle = trip?.title || "Chinh phục Đỉnh Núi Bà Đen 986m";
  const tripLocation =
    trip?.location?.name || "Núi Bà Đen, TP. Tây Ninh, Tỉnh Tây Ninh";
  const tripImage =
    trip?.image ||
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80";
  const tripDuration = trip?.duration || "6 ngày";
  const startDateStr = trip?.date
    ? `${trip.date.start} - ${trip.date.end}/${trip.date.year}`
    : "5 - 10/2026";
  const leaderName = trip?.leader?.name || "Leader hiện tại";
  const leaderRating = trip?.leader?.rating || 5.0;

  return (
    <div className="w-full shrink-0 space-y-4 lg:w-[380px]">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-gray-100">
        <div className="relative h-48">
          <Image
            src={tripImage}
            alt={tripTitle}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute right-4 top-4 rounded bg-amber-400 px-2 py-1 text-xs font-bold text-amber-950 shadow">
            Độ khó: {trip?.difficulty?.label || "Cấp 2 – Vừa phải"}
          </div>
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 text-white">
            <p className="text-xs font-medium uppercase tracking-wider opacity-90">
              {tripLocation}
            </p>
            <h3 className="mt-1 text-base font-bold leading-snug">
              {tripTitle}
            </h3>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex gap-3">
            <div className="flex flex-1 items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <svg
                className="mt-0.5 h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div>
                <p className="text-[11px] text-gray-500">Khởi hành</p>
                <p className="text-xs font-bold text-gray-900">{startDateStr}</p>
              </div>
            </div>

            <div className="flex flex-1 items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <svg
                className="mt-0.5 h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-[11px] text-gray-500">Thời lượng</p>
                <p className="text-xs font-bold text-gray-900">{tripDuration}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-y border-gray-100 py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 overflow-hidden rounded-full bg-gray-200">
                <Image
                  src={
                    trip?.leader?.avatar ||
                    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=2070&auto=format&fit=crop"
                  }
                  width={36}
                  height={36}
                  alt={leaderName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="flex items-center gap-1 text-sm font-bold text-gray-900">
                  {leaderName}
                  <svg
                    className="h-3.5 w-3.5 text-blue-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </p>
                <p className="text-[11px] text-gray-500">
                  Chứng chỉ WFA Cứu hộ Quốc Tế
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
              <svg
                className="h-3.5 w-3.5 text-amber-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{leaderRating.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-900">
              Chi tiết chi phí
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Giá vé tour ({unitPrice.toLocaleString("vi-VN")}₫ ×{" "}
                  {memberCount} người)
                </span>
                <strong className="text-gray-900">
                  {baseTripCost.toLocaleString("vi-VN")}₫
                </strong>
              </div>

              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-gray-600">
                  <svg
                    className="h-3.5 w-3.5 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Bảo hiểm mạo hiểm (100k/người)
                </span>
                <span className="font-semibold text-emerald-700">Miễn phí</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">
                  Phụ kiểm lâm & Bộ KIT VFRS
                </span>
                <span className="font-semibold text-gray-900">Đã bao gồm</span>
              </div>

              {equipmentCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Thuê thiết bị bổ sung</span>
                  <strong className="text-gray-900">
                    {equipmentCost.toLocaleString("vi-VN")}₫
                  </strong>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-600">Thuế VAT (8%)</span>
                <strong className="text-gray-900">
                  {vat.toLocaleString("vi-VN")}₫
                </strong>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex items-end justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    Tổng thanh toán
                  </h4>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    Đã gồm VAT ({memberCount} người) & bảo hiểm
                  </p>
                </div>
                <div className="text-2xl font-extrabold text-[#125238]">
                  {grandTotal.toLocaleString("vi-VN")}₫
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <div>
          <h4 className="text-xs font-bold text-emerald-950">
            Cam kết an toàn VFRS
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
            Hoàn cọc 100% nếu bão lũ bất khả kháng theo lệnh kiểm lâm, hoặc hủy
            trước 7 ngày khởi hành.
          </p>
        </div>
      </div>
    </div>
  );
};
