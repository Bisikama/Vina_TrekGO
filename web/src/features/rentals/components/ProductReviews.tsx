"use client";

import { useEffect, useState } from "react";

import { listProductReviews, type ProductReviewList } from "@/features/rentals/services/product-reviews.api";

function Stars({ value, className = "text-sm" }: { value: number; className?: string }) {
  return (
    <span className={`tracking-tight text-amber-400 ${className}`} aria-label={`${value.toFixed(1)} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={value >= star - 0.25 ? "" : value >= star - 0.75 ? "opacity-60" : "text-gray-200"}>★</span>
      ))}
    </span>
  );
}

/** Đánh giá từ người đã thuê thật. Lọc theo số sao; đổi bộ lọc thì tải lại từ trang 1. */
export function ProductReviews({ productId }: { productId: string }) {
  const [data, setData] = useState<ProductReviewList | null>(null);
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    listProductReviews(productId, { page, pageSize: 5, rating })
      .then((result) => {
        if (!active) return;
        setData((current) => (page > 1 && current ? { ...result, reviews: [...current.reviews, ...result.reviews] } : result));
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, page, rating]);

  const summary = data?.summary;
  const total = summary?.totalReviews ?? 0;

  return (
    <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-extrabold text-gray-900">Đánh giá từ người đã thuê</h2>
      {loading && !data ? (
        <p className="mt-4 text-sm text-gray-500">Đang tải đánh giá...</p>
      ) : failed && !data ? (
        <p className="mt-4 text-sm text-gray-500">Chưa tải được đánh giá.</p>
      ) : total === 0 && !rating ? (
        <p className="mt-4 text-sm text-gray-500">Chưa có đánh giá nào cho thiết bị này.</p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[220px_1fr]">
          <div>
            <p className="text-4xl font-black text-gray-900">{(summary?.averageRating ?? 0).toFixed(1)}</p>
            <Stars value={summary?.averageRating ?? 0} className="text-lg" />
            <p className="mt-1 text-xs text-gray-500">{total} đánh giá đã xác minh</p>
            <div className="mt-4 space-y-1.5">
              {(["5", "4", "3", "2", "1"] as const).map((star) => {
                const count = summary?.ratingBreakdown?.[star] ?? 0;
                const selected = rating === Number(star);
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => { setPage(1); setRating(selected ? undefined : Number(star)); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-0.5 text-xs ${selected ? "bg-amber-50 font-bold" : "hover:bg-gray-50"}`}
                  >
                    <span className="w-6 text-gray-500">{star}★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
                    </span>
                    <span className="w-6 text-right text-gray-500">{count}</span>
                  </button>
                );
              })}
            </div>
            {rating ? <button type="button" onClick={() => { setPage(1); setRating(undefined); }} className="mt-2 text-xs font-bold text-emerald-700 underline">Bỏ lọc {rating} sao</button> : null}
          </div>
          <div className="divide-y divide-gray-100">
            {data?.reviews.length === 0 ? <p className="py-3 text-sm text-gray-500">Không có đánh giá {rating} sao.</p> : null}
            {data?.reviews.map((review) => (
              <article key={review.id} className="py-4 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-gray-900">{review.userName}</p>
                  <Stars value={review.rating} />
                </div>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                  ✓ Đã thuê thật · {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                </p>
                {review.comment ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{review.comment}</p> : null}
              </article>
            ))}
            {data && data.pagination.page < data.pagination.totalPages ? (
              <button type="button" disabled={loading} onClick={() => setPage((current) => current + 1)} className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-700 disabled:opacity-50">
                {loading ? "Đang tải..." : "Xem thêm đánh giá"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
