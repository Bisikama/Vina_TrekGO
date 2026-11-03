"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createRentalReview, getReviewableItems, type ReviewableItem } from "@/features/rentals/services/user-rental.api";
import { getRentalApiErrorMessage } from "@/features/rentals/services/rental.api";
import { RentalPageHeader, shortCode } from "./RentalSectionNav";

export function RentalReviewFormPage({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<ReviewableItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { rating: number; comment: string }>>({});
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null); const [done, setDone] = useState(false);
  useEffect(() => { getReviewableItems(orderId).then((result) => { setItems(result.items ?? []); setDrafts(Object.fromEntries((result.items ?? []).map((item) => [item.productId, { rating: 5, comment: "" }]))); }).catch((reason) => setError(getRentalApiErrorMessage(reason, "Không thể tải sản phẩm cần đánh giá."))).finally(() => setLoading(false)); }, [orderId]);
  const pending = items.filter((item) => item.canReview);
  async function submit() { setSaving(true); setError(null); try { for (const item of pending) { const draft = drafts[item.productId] || { rating: 5, comment: "" }; await createRentalReview(orderId, { productId: item.productId, rating: draft.rating, comment: draft.comment.trim() || undefined }); } setDone(true); } catch (reason) { setError(getRentalApiErrorMessage(reason, "Chưa gửi được đánh giá.")); } finally { setSaving(false); } }
  return <main className="min-h-[650px] bg-[#F7F7F4] px-4 py-10 sm:px-6 lg:px-8"><section className="mx-auto max-w-4xl"><RentalPageHeader eyebrow={`Đơn #${shortCode(orderId)}`} title="Đánh giá thiết bị" description="Đánh giá từng món đồ bạn đã thực nhận trong chuyến đi." active="/rentals/reviews" />
    {loading ? <State text="Đang kiểm tra thiết bị đã nhận..." /> : done ? <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-sm"><h2 className="text-xl font-black text-emerald-800">Đã gửi đánh giá</h2><p className="mt-2 text-sm text-gray-500">Cảm ơn bạn đã giúp cộng đồng trekking chọn đồ tốt hơn.</p><Link href="/rentals/reviews" className="mt-5 inline-flex rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-extrabold text-white">Quay lại</Link></div> : <>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-6 space-y-4">{items.map((item) => { const draft = drafts[item.productId] || { rating: 5, comment: "" }; return <article key={item.productId} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">{item.product.sku || "Thiết bị trekking"}</p><h2 className="mt-2 text-lg font-black text-gray-900">{item.product.name}</h2>{item.canReview ? <><div className="mt-4 flex items-center gap-1">{[1,2,3,4,5].map((star) => <button key={star} onClick={() => setDrafts((current) => ({ ...current, [item.productId]: { ...draft, rating: star } }))} className={`text-3xl ${star <= draft.rating ? "text-amber-400" : "text-gray-200"}`}>★</button>)}<span className="ml-2 text-xs font-bold text-gray-500">{draft.rating}/5</span></div><textarea value={draft.comment} onChange={(event) => setDrafts((current) => ({ ...current, [item.productId]: { ...draft, comment: event.target.value } }))} maxLength={2000} placeholder="Thiết bị sạch không, sử dụng có ổn định không?..." className="mt-4 min-h-28 w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-emerald-600" /></> : <p className="mt-3 text-sm font-semibold text-gray-500">{item.isReviewed ? `Đã đánh giá ${item.rating}/5 sao` : "Sản phẩm chưa đủ điều kiện đánh giá."}</p>}</article>; })}</div>
      {pending.length > 0 && <button disabled={saving} onClick={submit} className="mt-5 w-full rounded-xl bg-[#1B5E41] px-5 py-3.5 text-sm font-extrabold text-white disabled:opacity-60">{saving ? "Đang gửi đánh giá..." : "Gửi đánh giá"}</button>}
    </>}
  </section></main>;
}
function State({ text }: { text: string }) { return <div className="mt-6 rounded-2xl bg-white p-10 text-center text-sm font-semibold text-gray-500 shadow-sm">{text}</div>; }
