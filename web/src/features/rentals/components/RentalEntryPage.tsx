"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  bookingApi,
  type BookingSummary,
} from "@/features/bookings/booking.api";
import {
  privateTripsApi,
  type PrivateTrip,
} from "@/features/trips/services/private-trips.api";
import { RentalCatalogPage } from "@/features/rentals/components/RentalCatalogPage";
import { RentalThreeVisual } from "@/features/rentals/components/visuals/RentalThreeVisual";

type RentalEntryPageProps = {
  tripId?: string;
};

const RENTABLE_BOOKING_STATUSES = new Set([
  "CONFIRMED",
  "CHECKED_IN",
  "PARTIAL_CHECKIN",
]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function tripCalendar(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  return {
    month: `THÁNG ${start.getMonth() + 1}`,
    day: String(start.getDate()).padStart(2, "0"),
    length: `${days + 1}N${Math.max(1, days)}Đ`,
  };
}

export function RentalEntryPage({ tripId }: RentalEntryPageProps) {
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [privateTrips, setPrivateTrips] = useState<PrivateTrip[]>([]);
  const [loading, setLoading] = useState(!tripId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tripId) {
      return;
    }

    let active = true;

    Promise.allSettled([bookingApi.list(1, ""), privateTripsApi.list()])
      .then(([bookingResult, privateTripResult]) => {
        if (!active) return;
        if (bookingResult.status === "fulfilled") {
          setBookings(bookingResult.value.items ?? []);
        }
        if (privateTripResult.status === "fulfilled") {
          setPrivateTrips(privateTripResult.value ?? []);
        }
        if (bookingResult.status === "rejected" && privateTripResult.status === "rejected") {
          throw bookingResult.reason;
        }
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError("Không thể tải danh sách chuyến đã đặt.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [tripId]);

  const rentableBookings = useMemo(
    () =>
      bookings.filter((booking) =>
        RENTABLE_BOOKING_STATUSES.has(booking.status),
      ),
    [bookings],
  );

  const rentablePrivateTrips = useMemo(
    () => privateTrips.filter((trip) => ["OPEN", "FULL", "CLOSED"].includes(trip.status)),
    [privateTrips],
  );

  const tripOptions = useMemo(
    () => [
      ...rentableBookings.map((booking) => ({ id: booking.trip.id, title: booking.trip.title, startAt: booking.trip.startAt, endAt: booking.trip.endAt, status: booking.status, type: "Chuyến công khai" })),
      ...rentablePrivateTrips.map((trip) => ({ id: trip.id, title: trip.title, startAt: trip.startAt, endAt: trip.endAt, status: trip.status, type: "Chuyến tự tổ chức" })),
    ],
    [rentableBookings, rentablePrivateTrips],
  );

  if (tripId) {
    return <RentalCatalogPage bookingId={tripId} />;
  }

  return (
    <main className="space-y-6">
        <RentalThreeVisual
          variant="trips"
          eyebrow="Bước 1 · Chọn chuyến đi"
          title="Chọn chuyến, hành trang theo sau."
          description="Vina TrekGo kiểm tra tư cách thành viên, hạn thuê và tồn kho theo đúng chuyến bạn chọn — để đồ sẵn sàng trước giờ xuất phát."
          checks={["Tư cách thành viên", "Hạn chót đặt thuê", "Tồn kho theo lịch"]}
        />

        {loading && (
          <div className="rounded-[22px] border border-[#d6ded6] bg-white p-8 text-center text-sm font-bold text-[#58685f]">
            Đang tải các chuyến đã xác nhận…
            <div className="mx-auto mt-4 h-1.5 max-w-md overflow-hidden rounded-full bg-[#e9eee9]"><span className="block h-full w-3/5 animate-pulse rounded-full bg-[#2c6e3e]" /></div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && tripOptions.length === 0 && (
          <div className="rounded-[22px] border border-dashed border-[#cbd6cc] bg-white p-8 text-center">
            <h2 className="text-xl font-extrabold text-gray-900">
              Chưa có chuyến phù hợp
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Bạn cần một booking đã được xác nhận trước khi thuê thiết bị.
            </p>
            <Link
              href="/trips"
              className="mt-5 inline-flex rounded-xl bg-[#1B5E41] px-5 py-3 text-sm font-bold text-white"
            >
              Khám phá chuyến đi
            </Link>
          </div>
        )}

        {!loading && tripOptions.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2c6e3e]">{tripOptions.length} chuyến đủ điều kiện</p>
                <h2 className="mt-1 text-[22px] font-black tracking-[-0.025em] text-[#0f1f17]">Chuyến sắp khởi hành của bạn</h2>
              </div>
              <p className="text-sm text-[#58685f]">Chỉ hiện booking đã xác nhận hoặc chuyến tự tổ chức đang mở.</p>
            </div>
            <div className="space-y-3">
            {tripOptions.map((trip) => {
              const calendar = tripCalendar(trip.startAt, trip.endAt);
              return (
              <article
                key={trip.id}
                className="flex flex-wrap overflow-hidden rounded-[22px] border border-[#d6ded6] bg-white transition hover:border-orange-400 hover:shadow-[0_16px_36px_rgba(15,31,23,0.1)]"
              >
                <div className="flex w-[138px] shrink-0 flex-col justify-center border-r border-dashed border-[#d6ded6] bg-[#f4f7f3] p-5">
                  <span className="text-[11px] font-black tracking-[0.14em] text-[#2c6e3e]">{calendar.month}</span>
                  <span className="text-[46px] font-black leading-none tracking-[-0.04em] text-[#102119]">{calendar.day}</span>
                  <span className="text-xs text-[#58685f]">{calendar.length}</span>
                </div>
                <div className="flex min-w-0 flex-[999_1_420px] flex-wrap items-center justify-between gap-5 p-5 sm:px-6">
                  <div className="min-w-0 flex-[1_1_350px]">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#e9ece7] px-3 py-1 text-[11px] font-bold text-[#58685f]">{trip.type}</span>
                      <span className="rounded-full bg-[#dcf3e3] px-3 py-1 text-[11px] font-bold text-[#145a32]">● {trip.status}</span>
                    </div>
                    <h2 className="mt-3 text-[21px] font-black tracking-[-0.025em] text-[#0f1f17]">
                      {trip.title}
                    </h2>
                    <p className="mt-2 text-sm text-[#58685f]">
                      {formatDate(trip.startAt)} – {formatDate(trip.endAt)}
                    </p>
                    <p className="mt-2 text-xs font-bold text-[#9a4a0e]">
                      ◷ Có thể thuê thiết bị trước thời hạn chuyến
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-[13px] border border-[#d6ded6] bg-white px-4 py-3 text-sm font-black text-[#102119]">⌾ Xem trên bản đồ</button>
                    <Link href={`/rentals?tripId=${encodeURIComponent(trip.id)}`} className="inline-flex shrink-0 justify-center rounded-[13px] bg-[#f58b36] px-5 py-3 text-sm font-black text-[#271205]">Chọn chuyến này →</Link>
                  </div>
                </div>
              </article>
              );
            })}
            </div>
          </section>
        )}
    </main>
  );
}
