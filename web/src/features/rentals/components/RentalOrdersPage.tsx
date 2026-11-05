"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { bookingApi } from "@/features/bookings/booking.api";
import { privateTripsApi } from "@/features/trips/services/private-trips.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { listMyRentalOrders } from "@/features/rentals/services/user-rental.api";
import type { RentalOrderSummary } from "@/features/rentals/types/rental";
import { dateTime, money, RentalPageHeader, shortCode } from "./RentalSectionNav";

// Mỗi nhóm trạng thái một màu: chờ thanh toán (cam), đang xử lý (xanh dương), đang thuê (xanh lá),
// trả đồ (tím), hoàn tất (xám xanh), hủy/hết hạn (đỏ nhạt / xám).
const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING_PAYMENT: { label: "Chờ thanh toán", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  PAID: { label: "Đã thanh toán", tone: "bg-sky-50 text-sky-800 ring-sky-200" },
  PREPARING: { label: "Đang chuẩn bị", tone: "bg-sky-50 text-sky-800 ring-sky-200" },
  READY_FOR_HANDOVER: { label: "Sẵn sàng giao", tone: "bg-sky-50 text-sky-800 ring-sky-200" },
  ACTIVE: { label: "Đang thuê", tone: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  RETURN_PENDING: { label: "Chờ trả đồ", tone: "bg-violet-50 text-violet-800 ring-violet-200" },
  RETURN_PROCESSING: { label: "Đang kiểm tra", tone: "bg-violet-50 text-violet-800 ring-violet-200" },
  COMPLETED: { label: "Hoàn tất", tone: "bg-teal-50 text-teal-800 ring-teal-200" },
  CANCELLED: { label: "Đã hủy", tone: "bg-red-50 text-red-700 ring-red-200" },
  EXPIRED: { label: "Hết hạn", tone: "bg-gray-100 text-gray-600 ring-gray-200" },
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
      // Chuyến không nằm trong trang booking đầu tiên: lấy tên trực tiếp theo tripId.
      const missing = [...new Set((result.items ?? []).map((order) => order.tripId))].filter((id) => id && !names[id]);
      if (missing.length) {
        void Promise.allSettled(missing.map((id) => bookingApi.trip(id))).then((trips) => {
          if (!active) return;
          const found: Record<string, string> = {};
          trips.forEach((trip, index) => {
            if (trip.status === "fulfilled" && trip.value?.title) found[missing[index]] = trip.value.title;
          });
          if (Object.keys(found).length) setTripNames((current) => ({ ...current, ...found }));
        });
      }
    }).catch((reason) => setError(getRentalApiErrorMessage(reason, "Không thể tải danh sách đơn thuê.")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const visible = useMemo(
    () => reviewMode ? orders.filter((order) => !["PENDING_PAYMENT", "CANCELLED", "EXPIRED"].includes(order.status)) : orders,
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
            {visible.map((order) => {
              const status = STATUS[order.status] ?? { label: order.status, tone: "bg-gray-100 text-gray-600 ring-gray-200" };
              const awaitingPayment =
                order.status === "PENDING_PAYMENT" && new Date(order.paymentExpiresAt).getTime() > Date.now();
              const reviewAllowed = order.status === "COMPLETED" && order.financialStatus === "SETTLED";
              const reviewMessage = order.status !== "COMPLETED"
                ? "Đơn vẫn đang trong quy trình sử dụng hoặc hoàn trả."
                : order.financialStatus !== "SETTLED"
                  ? "Đơn đã trả nhưng tiền cọc chưa quyết toán xong."
                  : "Đơn đã hoàn tất và sẵn sàng nhận đánh giá.";

              return (
              <article key={order.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-700">Đơn #{shortCode(order.id)}</p>
                    <h2 className="mt-2 text-lg font-semibold text-gray-900">{tripNames[order.tripId] || "Chuyến đi của bạn"}</h2>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${status.tone}`}>{status.label}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F7F8F5] p-4 text-sm">
                  <div><p className="text-xs text-gray-500">Tổng thanh toán</p><p className="mt-1 font-semibold text-gray-900">{money(order.totalAmount, order.currency)}</p></div>
                  {order.status === "PENDING_PAYMENT" ? (
                    <div><p className="text-xs text-gray-500">Hạn thanh toán</p><p className={`mt-1 font-semibold ${awaitingPayment ? "text-amber-800" : "text-gray-500"}`}>{dateTime(order.paymentExpiresAt)}</p></div>
                  ) : (
                    <div><p className="text-xs text-gray-500">Hạn trả</p><p className="mt-1 font-semibold text-gray-800">{dateTime(order.dueAt)}</p></div>
                  )}
                </div>
                {reviewMode ? (
                  <>
                    <p className="mt-4 text-xs leading-5 text-gray-500">{reviewMessage}</p>
                    {reviewAllowed ? (
                      <Link href={`/rentals/reviews/${order.id}`} className="mt-3 inline-flex rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-extrabold text-white">
                        Đánh giá thiết bị
                      </Link>
                    ) : (
                      <span className="mt-3 inline-flex cursor-not-allowed rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-extrabold text-gray-400">
                        {order.status !== "COMPLETED" ? "Chờ hoàn tất trả đồ" : "Đang quyết toán tiền cọc"}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {awaitingPayment ? (
                      <Link href={`/rentals/orders/${order.id}#thanh-toan`} className="inline-flex rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-700">
                        Thanh toán tiếp
                      </Link>
                    ) : null}
                    <Link href={`/rentals/orders/${order.id}`} className="inline-flex rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-semibold text-white">
                      Xem chi tiết
                    </Link>
                  </div>
                )}
              </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
function State({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={`mt-6 rounded-2xl border bg-white p-10 text-center text-sm font-semibold shadow-sm ${error ? "border-red-100 text-red-700" : "border-gray-100 text-gray-500"}`}>{text}</div>;
}
