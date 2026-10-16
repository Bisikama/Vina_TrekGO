"use client";

import React from "react";
import { TripData } from "@/features/trips/data/mockTripsData";

interface BookingStepsProps {
  trip?: TripData | null;
  currentStep?: 1 | 2 | 3;
}

export const BookingSteps = ({
  trip,
  currentStep = 1,
}: BookingStepsProps) => {
  const tripCode = trip?.id ? trip.id.slice(0, 8).toUpperCase() : "";
  const dateText = trip?.date
    ? `${trip.date.start} - ${trip.date.end}/${trip.date.year} (${trip.duration})`
    : "Lịch trình chính thức";
  const leaderText = trip?.leader?.name
    ? `Leader: ${trip.leader.name}`
    : "Leader đoàn";

  return (
    <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-gray-700">MÃ: #{tripCode}</span>
          <span className="text-gray-300">•</span>
          <span className="text-gray-600">{dateText}</span>
          <span className="text-gray-300">•</span>
          <span className="text-gray-600">{leaderText}</span>
        </div>
        <div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
            ● Đang mở cổng đặt chỗ
          </span>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Bước 1 */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-3 transition ${
            currentStep === 1
              ? "border-emerald-300 bg-emerald-50/70 shadow-xs"
              : currentStep > 1
              ? "border-emerald-200 bg-emerald-50/30"
              : "border-gray-100 bg-gray-50"
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold transition ${
              currentStep === 1
                ? "bg-[#125238] text-white"
                : currentStep > 1
                ? "bg-emerald-700 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {currentStep > 1 ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              "1"
            )}
          </div>
          <div>
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                currentStep >= 1 ? "text-emerald-800" : "text-gray-400"
              }`}
            >
              Bước 1 / 3
            </div>
            <div
              className={`text-sm font-bold ${
                currentStep >= 1 ? "text-gray-900" : "text-gray-400"
              }`}
            >
              Thành viên tham gia
            </div>
          </div>
        </div>

        {/* Bước 2 */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-3 transition ${
            currentStep === 2
              ? "border-emerald-300 bg-emerald-50/70 shadow-xs"
              : currentStep > 2
              ? "border-emerald-200 bg-emerald-50/30"
              : "border-gray-100 bg-gray-50"
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold transition ${
              currentStep === 2
                ? "bg-[#125238] text-white"
                : currentStep > 2
                ? "bg-emerald-700 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {currentStep > 2 ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              "2"
            )}
          </div>
          <div>
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                currentStep >= 2 ? "text-emerald-800" : "text-gray-400"
              }`}
            >
              Bước 2 / 3
            </div>
            <div
              className={`text-sm font-bold ${
                currentStep >= 2 ? "text-gray-900" : "text-gray-400"
              }`}
            >
              Rà soát & Thanh toán
            </div>
          </div>
        </div>

        {/* Bước 3 */}
        <div
          className={`flex items-center gap-3 rounded-xl border p-3 transition ${
            currentStep === 3
              ? "border-emerald-300 bg-emerald-50/70 shadow-xs"
              : "border-gray-100 bg-gray-50"
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold transition ${
              currentStep === 3
                ? "bg-[#125238] text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {currentStep === 3 ? (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              "3"
            )}
          </div>
          <div>
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                currentStep === 3 ? "text-emerald-800" : "text-gray-400"
              }`}
            >
              Bước 3 / 3
            </div>
            <div
              className={`text-sm font-bold ${
                currentStep === 3 ? "text-gray-900" : "text-gray-400"
              }`}
            >
              Hoàn tất đặt chỗ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
