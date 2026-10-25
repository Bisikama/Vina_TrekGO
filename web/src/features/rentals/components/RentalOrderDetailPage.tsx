/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { bookingApi } from "@/features/bookings/booking.api";
import { privateTripsApi } from "@/features/trips/services/private-trips.api";
import { getRentalApiErrorMessage, getRentalProduct } from "@/features/rentals/services/rental.api";
import { getMyRentalOrder, type RentalOrderDetail } from "@/features/rentals/services/user-rental.api";
import { dateTime, money, RentalPageHeader, shortCode } from "./RentalSectionNav";

type ProductVisual = { name: string; sku?: string; imageUrl?: string };

export function RentalOrderDetailPage({ orderId }: { orderId: string }) {
  const [detail, setDetail] = useState<RentalOrderDetail | null>(null);
  const [tripName, setTripName] = useState("Chuyến trekking của bạn");
  const [visuals, setVisuals] = useState<Record<string, ProductVisual>>({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; getMyRentalOrder(orderId).then(async (value) => {
    if (!active) return; setDetail(value);
    const [bookings, privateTrips, productResults] = await Promise.all([
      bookingApi.list(1, "").catch(() => null), privateTripsApi.list().catch(() => []),
      Promise.allSettled(value.items.map((item) => getRentalProduct(item.product.id || item.productId || ""))),
    ]);
    const booking = bookings?.items.find((item) => item.trip.id === value.order.tripId);
    const privateTrip = privateTrips.find((item) => item.id === value.order.tripId);
    if (active) {
      setTripName(booking?.trip.title || privateTrip?.title || "Chuyến trekking của bạn");
      setVisuals(Object.fromEntries(productResults.flatMap((result) => result.status === "fulfilled" ? [[result.value.id, { name: result.value.name, sku: result.value.sku, imageUrl: result.value.imageUrls[0] }]] : [])));
    }
  }).catch((reason) => active && setError(getRentalApiErrorMessage(reason, "Không thể tải chi tiết đơn thuê."))).finally(() => active && setLoading(false)); return () => { active = false; }; }, [orderId]);

  return <main className="min-h-[650px] bg-[#F7F7F4] px-4 py-10 sm:px-6 lg:px-8"><section className="mx-auto max-w-5xl"><RentalPageHeader eyebrow={`Đơn #${shortCode(orderId)}`} title={tripName} description="Chi tiết thiết bị, thời gian giao nhận và tình trạng tài chính của đơn thuê." active="/rentals/orders" />
    {loading ? <State text="Đang tải chi tiết đơn thuê..." /> : error || !detail ? <State text={error || "Không tìm thấy đơn thuê."} /> : <>
      <div className="mt-6 grid gap-4 md:grid-cols-3"><Info label="Trạng thái" value={detail.order.status.replaceAll("_", " ")} /><Info label="Tổng thanh toán" value={money(detail.order.totalAmount, detail.order.currency)} /><Info label="Hạn trả thiết bị" value={dateTime(detail.order.dueAt)} /></div>
      {detail.order.status === "PENDING_PAYMENT" && <PaymentCountdown expiresAt={detail.order.paymentExpiresAt} />}
      <section className="mt-6"><h2 className="text-xl font-black text-gray-900">Thiết bị trong đơn</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{detail.items.map((item) => { const visual = visuals[item.product.id] || item.product; return <article key={item.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">{visual.imageUrl ? <img src={visual.imageUrl} alt={visual.name} className="h-24 w-24 rounded-xl object-cover" /> : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-emerald-50 text-2xl">⛺</div>}<div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">{visual.sku || "Thiết bị trekking"}</p><h3 className="mt-1 font-black text-gray-900">{visual.name}</h3><p className="mt-2 text-xs text-gray-500">Số lượng: {item.quantity}</p><p className="mt-1 text-sm font-extrabold text-gray-900">{money(item.feeAmount, detail.order.currency)}</p></div></article>; })}</div></section>
      <div className="mt-6 grid gap-4 md:grid-cols-2"><Location title="Điểm nhận" point={detail.pickupPoint} /><Location title="Điểm trả" point={detail.returnPoint} /></div>
      <div className="mt-6 flex flex-wrap gap-3">{detail.order.status === "COMPLETED" && detail.order.financialStatus === "SETTLED" ? <Link href={`/rentals/reviews/${orderId}`} className="rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-extrabold text-white">Đánh giá thiết bị</Link> : <span className="cursor-not-allowed rounded-xl bg-gray-100 px-4 py-2.5 text-xs font-extrabold text-gray-400">Chỉ đánh giá sau khi hoàn tất trả đồ và quyết toán cọc</span>}<Link href="/rentals/transactions" className="rounded-xl border border-emerald-900/15 bg-white px-4 py-2.5 text-xs font-extrabold text-gray-700">Xem giao dịch</Link></div>
    </>}
  </section></main>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 font-extrabold text-gray-900">{value}</p></div>; }
function Location({ title, point }: { title: string; point: RentalOrderDetail["pickupPoint"] }) { return <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5"><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">{title}</p><p className="mt-2 font-black text-gray-900">{point?.name || "Chưa cập nhật"}</p><p className="mt-1 text-sm text-gray-600">{point?.address}</p></div>; }
function State({ text }: { text: string }) { return <div className="mt-6 rounded-2xl bg-white p-10 text-center text-sm font-semibold text-gray-500 shadow-sm">{text}</div>; }
function PaymentCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => { const tick = () => setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now())); tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [expiresAt]);
  const minutes = Math.floor(remaining / 60000); const seconds = Math.floor((remaining % 60000) / 1000);
  return <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Thời gian giữ đơn</p><p className="mt-2 text-2xl font-black text-amber-900">{remaining > 0 ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : "Đã hết hạn"}</p><p className="mt-1 text-xs text-amber-800">Hoàn tất chuyển khoản trước khi đồng hồ kết thúc.</p></div>;
}
