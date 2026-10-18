"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import {
  bookingApiService,
  formatMoneyVND,
} from "@/features/bookings/services/booking.api";
import type {
  BookingDetail,
  BookingSummary,
  PageResponse,
  PublicBookingTrip,
} from "@/features/bookings/types/booking.types";
import {
  privateTripsApi,
  type PrivateTrip,
} from "../services/private-trips.api";
import { useStaticDataStore } from "@/lib/staticDataStore";

type UpcomingItem =
  | {
      kind: "BOOKING";
      summary: BookingSummary;
      detail?: BookingDetail | null;
      publicTrip?: PublicBookingTrip | null;
    }
  | {
      kind: "PRIVATE";
      trip: PrivateTrip;
      pickupName?: string;
    };

function getCountdownParts(targetIso: string) {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) {
    return { isOngoing: true, days: 0, hours: 0, minutes: 0 };
  }
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { isOngoing: false, days, hours, minutes };
}

function formatDateTimeVN(iso: string) {
  if (!iso) return "Chưa cập nhật";
  return new Date(iso).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDurationLabel(startIso: string, endIso: string) {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  return `${days} Ngày`;
}

export const UpcomingTripHero = () => {
  const [, setTick] = useState(0);

  const { data: bookingsPage, isLoading: bookingsLoading } =
    useSWR<PageResponse<BookingSummary>>(
      ["my-bookings", 1, 50, ""],
      () => bookingApiService.listMyBookings({ page: 1, pageSize: 50 }),
      {
        revalidateOnFocus: true,
        dedupingInterval: 5000,
        keepPreviousData: true,
      }
    );

  const { data: privateTrips, isLoading: privateLoading } = useSWR<
    PrivateTrip[]
  >("private-trips", () => privateTripsApi.list(), {
    revalidateOnFocus: true,
    dedupingInterval: 5000,
    keepPreviousData: true,
  });

  const candidate = useMemo(() => {
    const now = new Date();
    const upcomingBookings = (bookingsPage?.items || [])
      .filter(
        (b) =>
          (b.status === "CONFIRMED" || b.status === "CHECKED_IN") &&
          new Date(b.trip.endAt) > now
      )
      .sort(
        (a, b) =>
          new Date(a.trip.startAt).getTime() -
          new Date(b.trip.startAt).getTime()
      );

    const upcomingPrivate = (privateTrips || [])
      .filter((t) => t.status !== "CANCELLED" && new Date(t.endAt) > now)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );

    const nextBooking = upcomingBookings[0];
    const nextPrivate = upcomingPrivate[0];

    if (!nextBooking && !nextPrivate) return null;

    const pickBooking =
      nextBooking &&
      (!nextPrivate ||
        new Date(nextBooking.trip.startAt).getTime() <=
          new Date(nextPrivate.startAt).getTime());

    if (pickBooking && nextBooking) {
      return { kind: "BOOKING" as const, summary: nextBooking };
    }
    if (nextPrivate) {
      return { kind: "PRIVATE" as const, trip: nextPrivate };
    }
    return null;
  }, [bookingsPage, privateTrips]);

  const selectedBookingId =
    candidate?.kind === "BOOKING" ? candidate.summary.id : null;
  const selectedBookingTripId =
    candidate?.kind === "BOOKING" ? candidate.summary.trip.id : null;

  const { data: bookingDetail } = useSWR<BookingDetail>(
    selectedBookingId ? ["booking-detail", selectedBookingId] : null,
    ([, id]: [string, string]) => bookingApiService.getBookingDetail(id),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const { data: publicTripDetail } = useSWR<PublicBookingTrip>(
    selectedBookingTripId
      ? ["public-booking-trip-detail", selectedBookingTripId]
      : null,
    ([, id]: [string, string]) => bookingApiService.getPublicTripDetail(id),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const pickupsByDestination = useStaticDataStore(
    (s) => s.pickupsByDestination
  );
  const loadPickupsForDestination = useStaticDataStore(
    (s) => s.loadPickupsForDestination
  );

  const privateDestId =
    candidate?.kind === "PRIVATE" ? candidate.trip.destinationId : null;

  useEffect(() => {
    if (privateDestId) {
      void loadPickupsForDestination(privateDestId);
    }
  }, [privateDestId, loadPickupsForDestination]);

  const upcoming: UpcomingItem | null = useMemo(() => {
    if (!candidate) return null;
    if (candidate.kind === "BOOKING") {
      return {
        kind: "BOOKING",
        summary: candidate.summary,
        detail: bookingDetail ?? null,
        publicTrip: publicTripDetail ?? null,
      };
    }
    const pickups = candidate.trip.destinationId
      ? pickupsByDestination[candidate.trip.destinationId] || []
      : [];
    const pickupName = pickups.find(
      (p) => p.id === candidate.trip.pickupPointId
    )?.name;
    return {
      kind: "PRIVATE",
      trip: candidate.trip,
      pickupName,
    };
  }, [candidate, bookingDetail, publicTripDetail, pickupsByDestination]);

  const loading =
    !bookingsPage && !privateTrips && (bookingsLoading || privateLoading);

  useEffect(() => {
    if (!upcoming) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, [upcoming]);

  if (loading) {
    return (
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 mb-4">
          <h2 className="text-[17px] font-extrabold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#154B36]"></span>
            Chuyến đi sắp tới của bạn
          </h2>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl h-72 animate-pulse p-8" />
      </div>
    );
  }

  if (!upcoming) {
    return (
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 mb-4">
          <h2 className="text-[17px] font-extrabold text-gray-900 flex items-center gap-2">
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#154B36]"></span>
            Chuyến đi sắp tới của bạn
          </h2>
          <Link
            href="/my-trips"
            className="text-[12px] font-bold text-[#154B36] hover:underline"
          >
            Xem lịch sử chuyến đi →
          </Link>
        </div>

        <div className="bg-white border border-dashed border-gray-200 rounded-3xl p-8 sm:p-10 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#E6F4EA] text-[#154B36] flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6"
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
          </div>
          <h3 className="text-base font-extrabold text-gray-900 mb-1">
            Bạn chưa có chuyến đi nào sắp khởi hành
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mb-5">
            Đặt chỗ tham gia các đoàn mở có Mountain Leader dẫn đường hoặc tự
            tổ chức chuyến đi riêng cùng nhóm bạn.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/trips"
              className="bg-[#154B36] hover:bg-[#0D3425] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors"
            >
              Khám phá chuyến đi mở
            </Link>
            <Link
              href="/my-trips/create"
              className="bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#154B36] border border-emerald-200 px-5 py-2.5 rounded-xl text-xs font-bold transition-colors"
            >
              + Tổ chức chuyến đi riêng
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isBooking = upcoming.kind === "BOOKING";
  const startAt = isBooking
    ? upcoming.summary.trip.startAt
    : upcoming.trip.startAt;
  const endAt = isBooking ? upcoming.summary.trip.endAt : upcoming.trip.endAt;
  const title = isBooking ? upcoming.summary.trip.title : upcoming.trip.title;
  const countdown = getCountdownParts(startAt);
  const durationLabel = getDurationLabel(startAt, endAt);

  const destinationName = isBooking
    ? upcoming.publicTrip?.destination?.name || "Việt Nam"
    : "Chuyến đi riêng tư";

  const pickupTitle = isBooking
    ? upcoming.detail?.pickup?.name ||
      upcoming.publicTrip?.pickup?.name ||
      "Điểm tập kết theo lịch đoàn"
    : upcoming.pickupName || "Điểm tập kết nhóm";

  const pickupAddress = isBooking
    ? upcoming.detail?.pickup?.address ||
      upcoming.publicTrip?.pickup?.address ||
      ""
    : "";

  const routeInfo = isBooking ? upcoming.publicTrip?.routes?.[0] : undefined;

  return (
    <div className="mb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 mb-4">
        <h2 className="text-[17px] font-extrabold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#154B36]"></span>
          Chuyến đi sắp tới của bạn
        </h2>
        <span className="text-[11px] text-gray-400 font-medium">
          Lịch trình tự động đồng bộ theo múi giờ GMT+7
        </span>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col lg:flex-row">
        {/* Left Side: Image */}
        <div className="w-full lg:w-5/12 relative h-64 sm:h-72 lg:h-auto lg:min-h-[340px]">
          <Image
            src="/hero-trekking.jpg"
            alt={title}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

          <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-start gap-2">
            <span className="bg-white/90 backdrop-blur text-gray-900 px-3 py-1 rounded-full text-[10px] font-bold">
              {isBooking
                ? `Mã đặt chỗ: #${upcoming.summary.id.slice(0, 8)}`
                : "Chuyến tự tổ chức"}
            </span>
            <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              {durationLabel}
              {routeInfo?.snapshotDifficulty
                ? ` • ${routeInfo.snapshotDifficulty}`
                : ""}
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4 text-white">
            <div className="flex items-center gap-1.5 text-[11px] font-medium mb-1 opacity-90">
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              {destinationName}
            </div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight line-clamp-2">
              {routeInfo?.snapshotName || title}
            </h3>
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="w-full lg:w-7/12 p-5 sm:p-6 lg:p-8 flex flex-col min-w-0">
          {/* Countdown */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F8FAFC] border border-gray-100 rounded-xl px-4 py-3 mb-6">
            <div className="flex items-center gap-2 text-[#154B36] font-bold text-[12px]">
              <span className="w-2 h-2 shrink-0 rounded-full bg-emerald-500 animate-pulse"></span>
              {countdown.isOngoing
                ? "Trạng thái hành trình:"
                : "Đếm ngược giờ xuất phát:"}
            </div>
            {countdown.isOngoing ? (
              <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-extrabold">
                Đang diễn ra
              </span>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-2.5 py-1 text-center min-w-[56px] sm:min-w-[60px]">
                  <div className="text-[12px] sm:text-[13px] font-black text-gray-900 leading-none whitespace-nowrap">
                    {String(countdown.days).padStart(2, "0")} NGÀY
                  </div>
                </div>
                <span className="text-gray-300 font-bold">:</span>
                <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-2.5 py-1 text-center min-w-[56px] sm:min-w-[60px]">
                  <div className="text-[12px] sm:text-[13px] font-black text-gray-900 leading-none whitespace-nowrap">
                    {String(countdown.hours).padStart(2, "0")} GIỜ
                  </div>
                </div>
                <span className="text-gray-300 font-bold">:</span>
                <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-2.5 py-1 text-center min-w-[56px] sm:min-w-[60px]">
                  <div className="text-[12px] sm:text-[13px] font-black text-gray-900 leading-none whitespace-nowrap">
                    {String(countdown.minutes).padStart(2, "0")} PHÚT
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 mb-2 font-medium">
            <svg
              className="w-3.5 h-3.5 shrink-0"
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
            <span>
              Khởi hành: {formatDateTimeVN(startAt)} • Kết thúc:{" "}
              {formatDateTimeVN(endAt)}
            </span>
          </div>

          <h3 className="text-xl sm:text-[22px] font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
            {title}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F0FDF4] text-[#154B36] flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-gray-900 mb-0.5">
                  Điểm tập kết & giờ hẹn
                </div>
                <div className="text-[13px] font-black text-[#154B36] mb-1">
                  {formatDateTimeVN(startAt)}
                </div>
                <div className="text-[11px] text-gray-500 leading-tight break-words">
                  {pickupTitle}
                  {pickupAddress ? ` (${pickupAddress})` : ""}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-[#154B36] flex items-center justify-center flex-shrink-0 font-bold text-sm">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                {isBooking ? (
                  <>
                    <div className="text-[10px] text-gray-500 mb-0.5">
                      Mountain Leader & Đăng ký
                    </div>
                    <div className="text-[13px] font-bold text-gray-900 mb-1 truncate">
                      {upcoming.publicTrip?.leader?.fullName ||
                        "Đoàn tiêu chuẩn VinaTrekGO"}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      {upcoming.summary.participantCount} thành viên •{" "}
                      {formatMoneyVND(upcoming.summary.totalAmount)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] text-gray-500 mb-0.5">
                      Hình thức & Sức chứa nhóm
                    </div>
                    <div className="text-[13px] font-bold text-gray-900 mb-1">
                      Nhóm riêng tư ({upcoming.trip.status})
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      Tối đa {upcoming.trip.maxPax} thành viên
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-gray-100 flex flex-wrap gap-3">
            {isBooking ? (
              <>
                <Link
                  href={`/bookings/${upcoming.summary.id}`}
                  className="bg-[#154B36] hover:bg-[#0D3425] text-white px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    />
                  </svg>
                  Xem vé & Chi tiết chuyến đi
                </Link>
                <Link
                  href={`/trips/${upcoming.summary.trip.id}`}
                  className="bg-[#F1F5F9] hover:bg-[#E2E8F0] text-gray-700 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  Xem bản đồ cung đường
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={`/my-trips/${upcoming.trip.id}`}
                  className="bg-[#154B36] hover:bg-[#0D3425] text-white px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  Xem chi tiết & Quản lý nhóm
                </Link>
                <Link
                  href="/my-trips"
                  className="bg-[#F1F5F9] hover:bg-[#E2E8F0] text-gray-700 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2"
                >
                  Danh sách chuyến đi của tôi
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
