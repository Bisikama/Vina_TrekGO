"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { bookingApi } from "@/features/bookings/booking.api";
import { privateTripsApi } from "@/features/trips/services/private-trips.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { listMyRentalOrders } from "@/features/rentals/services/user-rental.api";
import type { RentalOrderSummary } from "@/features/rentals/types/rental";
import { dateTime, money, RentalPageHeader, shortCode } from "./RentalSectionNav";

const labels: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán", PAID: "Đã thanh toán", PREPARING: "Đang chuẩn bị",
  READY_FOR_HANDOVER: "Sẵn sàng giao", ACTIVE: "Đang thuê", RETURN_PENDING: "Chờ trả đồ",
  RETURN_PROCESSING: "Đang kiểm tra", COMPLETED: "Hoàn tất", CANCELLED: "Đã hủy", EXPIRED: "Hết hạn",
};

export function RentalOrdersPage({ reviewMode = false }: { reviewMode?: boolean }) {
  const [orders, setOrders] = useState<RentalOrderSummary[]>([]);
  const [tripNames, setTripNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listMyRentalOrders(),
      Promise.allSettled([bookingApi.list(1, ""), privateTripsApi.list()]),
    ]).then(([result, tripResults]) => {
      if (!active) return;
      setOrders(result.items ?? []);
      const names: Record<string, string> = {};
      const bookings = tripResults[0];
      const privateTrips = tripResults[1];
      if (bookings.status === "fulfilled") bookings.value.items.forEach((item) => { names[item.trip.id] = item.trip.title; });
      if (privateTrips.status === "fulfilled") privateTrips.value.forEach((item) => { names[item.id] = item.title; });
      setTripNames(names);
    }).catch((reason) => setError(getRentalApiErrorMessage(reason, "Không thể tải danh sách đơn thuê.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const visible = useMemo(
    () => reviewMode ? orders.filter((order) => ["ACTIVE", "RETURN_PENDING", "RETURN_PROCESSING", "COMPLETED"].includes(order.status)) : orders,
    [orders, reviewMode],
  );

  return (
    <main className="min-h-[650px] bg-[#F7F7F4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <RentalPageHeader
          eyebrow="Thuê thiết bị"
          title={reviewMode ? "Đánh giá thiết bị" : "Đơn thuê của bạn"}
          description={reviewMode ? "Chọn đơn đã nhận thiết bị để chia sẻ trải nghiệm thực tế." : "Theo dõi toàn bộ quá trình từ thanh toán, chuẩn bị, giao nhận đến hoàn cọc."}
          active={reviewMode ? "/rentals/reviews" : "/rentals/orders"}
        />
        {loading ? <State text="Đang kiểm tra hành trình đơn thuê..." /> : error ? <State text={error} error /> : visible.length === 0 ? (
          <State text={reviewMode ? "Chưa có đơn đủ điều kiện đánh giá." : "Bạn chưa có đơn thuê nào."} />
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {visible.map((order) => (
              <article key={order.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-700">Đơn #{shortCode(order.id)}</p>
                    <h2 className="mt-2 text-lg font-black text-gray-900">{tripNames[order.tripId] || "Chuyến trekking của bạn"}</h2>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">{labels[order.status] || order.status}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F7F8F5] p-4 text-sm">
                  <div><p className="text-xs text-gray-500">Tổng thanh toán</p><p className="mt-1 font-extrabold text-gray-900">{money(order.totalAmount, order.currency)}</p></div>
                  <div><p className="text-xs text-gray-500">Hạn trả</p><p className="mt-1 font-bold text-gray-800">{dateTime(order.dueAt)}</p></div>
                </div>
                <Link href={reviewMode ? `/rentals/reviews/${order.id}` : `/rentals/orders/${order.id}`} className="mt-4 inline-flex rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-extrabold text-white">
                  {reviewMode ? "Mở đánh giá" : "Xem chi tiết"}
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
function State({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`mt-6 rounded-2xl border bg-white p-10 text-center text-sm font-semibold shadow-sm ${error ? "border-red-100 text-red-700" : "border-gray-100 text-gray-500"}`}>{text}</div>;
}
