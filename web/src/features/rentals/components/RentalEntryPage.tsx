"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  bookingApi,
  type BookingSummary,
} from "@/features/bookings/booking.api";
import { RentalCatalogPage } from "@/features/rentals/components/RentalCatalogPage";

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

export function RentalEntryPage({ tripId }: RentalEntryPageProps) {
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(!tripId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tripId) {
      return;
    }

    let active = true;

    bookingApi
      .list(1, "")
      .then((result) => {
        if (!active) return;
        setBookings(result.items ?? []);
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

  if (tripId) {
    return <RentalCatalogPage bookingId={tripId} />;
  }

  return (
    <main className="min-h-[650px] bg-[#F7F7F4] px-4 py-12 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-[#153E2E] p-7 text-white shadow-sm sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
            Rental context
          </p>
          <h1 className="mt-3 text-3xl font-black">
            Chọn chuyến đi để thuê thiết bị
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">
            TrekGo sẽ kiểm tra tư cách thành viên, hạn thuê và tồn kho theo chuyến bạn chọn.
          </p>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm font-semibold text-gray-500 shadow-sm">
            Đang tải các chuyến đã xác nhận...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && rentableBookings.length === 0 && (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center shadow-sm">
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

        {!loading && rentableBookings.length > 0 && (
          <div className="mt-6 grid gap-4">
            {rentableBookings.map((booking) => (
              <article
                key={booking.id}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                      {booking.status}
                    </span>
                    <h2 className="mt-3 text-xl font-extrabold text-gray-900">
                      {booking.trip.title}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                      {formatDate(booking.trip.startAt)} – {formatDate(booking.trip.endAt)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Booking: {booking.id}
                    </p>
                  </div>

                  <Link
                    href={`/rentals?tripId=${encodeURIComponent(booking.trip.id)}`}
                    className="inline-flex shrink-0 justify-center rounded-xl bg-[#1B5E41] px-5 py-3 text-sm font-extrabold text-white"
                  >
                    Chọn chuyến này
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
