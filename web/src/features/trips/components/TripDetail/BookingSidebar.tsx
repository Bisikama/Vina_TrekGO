"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TripData } from "../../data/mockTripsData";
import { useAuth } from "@/features/auth";
import { bookingApiService } from "@/features/bookings/services/booking.api";
import type { BookingSummary } from "@/features/bookings/types/booking.types";

export const BookingSidebar = ({ trip }: { trip: TripData }) => {
  const { accessToken } = useAuth();
  const [myBooking, setMyBooking] = useState<BookingSummary | null>(null);
  const [participants, setParticipants] = useState(1);
  const isFullyBooked = trip.slots.booked >= trip.slots.total;

  useEffect(() => {
    if (!trip?.id) return;
    bookingApiService
      .listMyBookings({ pageSize: 50 })
      .then((res) => {
        const found = res?.items?.find(
          (b) =>
            b.trip?.id === trip.id &&
            (b.status === "CONFIRMED" || b.status === "CHECKED_IN" || b.status === "COMPLETED")
        );
        if (found) setMyBooking(found);
      })
      .catch(() => {});
  }, [trip?.id]);

  return (
    <div className="sticky top-24 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {myBooking ? (
        <div className="p-6 space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shadow-sm font-bold text-xl">
              ✓
            </div>
            <div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                Đã đặt & xác nhận vé
              </span>
              <h3 className="mt-2 text-base font-extrabold text-gray-900">
                Bạn đã tham gia chuyến đi này!
              </h3>
              <p className="mt-1 text-xs text-gray-600">
                Số lượng: <strong>{myBooking.participantCount} thành viên</strong>
              </p>
              <p className="text-xs font-bold text-emerald-800 mt-1">
                Tổng đã thanh toán: {Number(myBooking.totalAmount).toLocaleString("vi-VN")}₫
              </p>
            </div>

            <Link
              href={`/bookings/${myBooking.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B5E41] py-3 text-xs font-bold text-white shadow-md shadow-emerald-900/10 hover:bg-[#154B36] transition cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Xem Chi Tiết Vé Đặt Chỗ →
            </Link>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/my-trips"
              className="text-xs font-bold text-emerald-800 hover:underline"
            >
              ← Xem tất cả chuyến đi của tôi
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Price Header */}
          <div className="border-b border-gray-100 p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Giá trọn gói / người
                </div>
                <div className="text-2xl font-extrabold text-[#1B5E41]">
                  {trip.price.toLocaleString("vi-VN")}đ
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                  <span>✓</span>
                  <span>Đã gồm xe đưa đón, ăn uống, vé & bảo hiểm</span>
                </div>
              </div>
              <div className="text-right">
                <span className="rounded border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                  Bảo hiểm VFRS
                </span>
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
                    {trip.date.start} – {trip.date.end}/{trip.date.year}
                  </div>
                </div>
                <div className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                  Cố định
                </div>
              </div>
            </div>

        {/* Quy mô & Tiến độ gom chỗ */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-gray-700">Quy mô đoàn</span>
            <span className="font-extrabold text-gray-900">
              {trip.slots.min || 1} – {trip.slots.total} người
            </span>
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-500 font-medium">
                Đã đặt: <strong className="text-gray-900">{trip.slots.booked}/{trip.slots.total} chỗ</strong>
              </span>
              <span className="font-bold text-emerald-700">
                Còn {Math.max(0, trip.slots.total - trip.slots.booked)} chỗ
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-[#1B5E41] transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.min(100, Math.round((trip.slots.booked / Math.max(1, trip.slots.total)) * 100))}%`,
                }}
              />
            </div>
          </div>

          <div className="text-[11px] leading-tight">
            {trip.slots.booked >= (trip.slots.min || 1) ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <span className="text-xs">✓</span> Đã đủ số lượng tối thiểu để khởi hành ({trip.slots.booked}/{trip.slots.min || 1})
              </span>
            ) : (
              <span className="text-amber-800 font-semibold flex items-center gap-1">
                <span>⚡</span> Đang gom đoàn (còn thiếu {(trip.slots.min || 1) - trip.slots.booked} người để đạt tối thiểu {trip.slots.min || 1})
              </span>
            )}
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
    </>
  )}
</div>
  );
};
