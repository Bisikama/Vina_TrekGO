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
import { RentalSectionNav } from "@/features/rentals/components/RentalSectionNav";

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

        <div className="mt-5">
          <RentalSectionNav active="/rentals" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["/rentals/orders", "Đơn thuê", "Theo dõi giao nhận và hoàn cọc"],
            ["/rentals/wardrobe", "Tủ đồ", "Khai báo đồ trekking đang có"],
            ["/rentals/reviews", "Đánh giá", "Nhận xét thiết bị đã dùng"],
            ["/rentals/transactions", "Lịch sử giao dịch", "Thanh toán và hoàn tiền"],
          ].map(([href, title, description]) => (
            <Link key={href} href={href} className="rounded-2xl border border-emerald-900/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/30">
              <p className="text-sm font-extrabold text-gray-900">{title}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
            </Link>
          ))}
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

        {!loading && !error && tripOptions.length === 0 && (
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

        {!loading && tripOptions.length > 0 && (
          <div className="mt-6 grid gap-4">
            {tripOptions.map((trip) => (
              <article
                key={trip.id}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                      {trip.type} · {trip.status}
                    </span>
                    <h2 className="mt-3 text-xl font-extrabold text-gray-900">
                      {trip.title}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                      {formatDate(trip.startAt)} – {formatDate(trip.endAt)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Sẵn sàng kiểm tra hành trang cho chuyến này
                    </p>
                  </div>

                  <Link
                    href={`/rentals?tripId=${encodeURIComponent(trip.id)}`}
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
