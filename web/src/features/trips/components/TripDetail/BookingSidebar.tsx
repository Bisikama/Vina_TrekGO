"use client";

import { useState } from "react";
import Link from "next/link";
import { TripData } from "../../data/mockTripsData";

export const BookingSidebar = ({ trip }: { trip: TripData }) => {
  const [participants, setParticipants] = useState(2);
  const isFullyBooked = trip.slots.booked >= trip.slots.total;

  return (
    <div className="sticky top-24 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Price Header */}
      <div className="border-b border-gray-100 p-5">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Giá trọn gói / người
            </div>
            <div className="text-2xl font-extrabold text-[#1B5E41]">
              {trip.price.toLocaleString("vi-VN")}đ
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold text-gray-400 line-through">
              {(trip.price * 1.15).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ
            </div>
            <div className="rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
              -14% Early Bird
            </div>
          </div>
        </div>
      </div>

      {/* Booking Form */}
      <div className="space-y-4 p-5">
        {/* Date Selector */}
        <div>
          <label className="mb-2 block text-xs font-bold text-gray-700">
            Chọn ngày khởi hành
          </label>
          <div className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 p-3">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              <div className="text-sm font-bold text-gray-900">
                {trip.date.start} - {trip.date.end}/{trip.date.year}
              </div>
            </div>
            <div className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
              Cố định
            </div>
          </div>
        </div>

        {/* Participants Selector */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-700">
              Số lượng thành viên
            </label>
            <span className="text-[10px] font-medium text-emerald-600">
              {trip.slots.statusText ||
                `Còn ${trip.slots.total - trip.slots.booked} chỗ`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex w-32 shrink-0 items-center rounded-xl border border-gray-200 bg-gray-50">
              <button
                onClick={() => setParticipants(Math.max(1, participants - 1))}
                className="flex h-10 w-10 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                disabled={isFullyBooked}
              >
                -
              </button>
              <div className="flex-1 text-center font-bold text-gray-900">
                {participants}
              </div>
              <button
                onClick={() =>
                  setParticipants(
                    Math.min(
                      Math.max(1, trip.slots.total - trip.slots.booked),
                      participants + 1,
                    ),
                  )
                }
                className="flex h-10 w-10 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                disabled={isFullyBooked}
              >
                +
              </button>
            </div>
            <div className="flex-1 text-right">
              <div className="text-[10px] font-medium text-gray-500">
                Tổng tạm tính
              </div>
              <div className="text-lg font-bold text-gray-900">
                {(trip.price * participants).toLocaleString("vi-VN")}đ
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-2 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div className="text-[11px] leading-tight text-emerald-800">
            Tài khoản đã xác thực. Bạn sẽ không bị trừ tiền ngay cho đến khi
            Leader xác nhận lịch đặt.
          </div>
        </div>

        <Link
          href={`/bookings/${trip.id}?participants=${participants}`}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold transition-colors ${
            isFullyBooked
              ? "pointer-events-none cursor-not-allowed bg-gray-100 text-gray-400"
              : "bg-[#1B5E41] text-white shadow-md shadow-emerald-900/10 hover:bg-[#154B36]"
          }`}
        >
          {isFullyBooked ? "Đã hết chỗ" : "Đặt chuyến đi này"}
          {!isFullyBooked && (
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              ></path>
            </svg>
          )}
        </Link>

        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B5E41]/10 py-2 text-xs font-bold text-[#1B5E41] transition-colors hover:bg-[#1B5E41]/20">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            ></path>
          </svg>
          Yêu cầu tư vấn thêm qua Zalo/Hotline
        </button>

        <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-gray-500">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            ></path>
          </svg>
          Bảo mật thanh toán VNPAY/Momo 100%
        </div>
      </div>
    </div>
  );
};
