/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getRentalCatalog } from "@/features/rentals/services/rental.api";
import type {
  RentalCatalogData,
  RentalCatalogItem,
} from "@/features/rentals/types/rental";

type RentalCatalogPageProps = {
  bookingId: string;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: currency || "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Không thể tải danh sách thiết bị.";
}

function ProductCard({
  item,
  bookingId,
}: {
  item: RentalCatalogItem;
  bookingId: string;
}) {
  const imageUrl = item.imageUrls[0];
  const available = item.availableCount > 0;

  const detailUrl = `/rental-products/${encodeURIComponent(
    item.id,
  )}?bookingId=${encodeURIComponent(bookingId)}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link
        href={detailUrl}
        className="relative block aspect-[4/3] overflow-hidden bg-[#EEF3EF]"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-semibold text-gray-400">
            Chưa có ảnh thiết bị
          </div>
        )}

        {item.recommendation && (
          <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-extrabold text-gray-950 shadow-sm">
            Đề xuất cho chuyến đi
          </span>
        )}

        <span
          className={`absolute bottom-3 right-3 rounded-full px-3 py-1 text-[11px] font-bold shadow-sm ${
            available
              ? "bg-emerald-600 text-white"
              : "bg-gray-700 text-white"
          }`}
        >
          {available
            ? `Còn ${item.availableCount}`
            : "Tạm hết"}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
            {item.category.name}
          </span>
        </div>

        <Link href={detailUrl}>
          <h2 className="text-lg font-extrabold text-gray-900 transition group-hover:text-[#1B5E41]">
            {item.name}
          </h2>
        </Link>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">
          {item.description}
        </p>

        {item.recommendation?.reasons[0] && (
          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <span className="font-bold">Phù hợp: </span>
            {item.recommendation.reasons[0]}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between border-t border-gray-100 pt-5">
          <div>
            <p className="text-[11px] font-medium text-gray-500">
              Giá thuê mỗi ngày
            </p>

            <p className="mt-1 text-xl font-extrabold text-[#1B5E41]">
              {formatMoney(item.dailyPrice, item.currency)}
            </p>
          </div>

          <Link
            href={detailUrl}
            className="rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#154B36]"
          >
            Xem chi tiết
          </Link>
        </div>
      </div>
    </article>
  );
}

export function RentalCatalogPage({
  bookingId,
}: RentalCatalogPageProps) {
  const [data, setData] = useState<RentalCatalogData | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const result = await getRentalCatalog(
          bookingId,
          signal,
        );

        setData(result);
      } catch (loadError) {
        if (!signal?.aborted) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [bookingId],
  );

    useEffect(() => {
    const controller = new AbortController();

    getRentalCatalog(bookingId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [bookingId]);

  const filteredItems = useMemo(() => {
    if (!data) {
      return [];
    }

    const keyword = search.trim().toLocaleLowerCase("vi");

    return data.items.filter((item) => {
      const matchesCategory =
        categoryId === "all" ||
        item.category.id === categoryId;

      const matchesSearch =
        !keyword ||
        item.name.toLocaleLowerCase("vi").includes(keyword) ||
        item.description
          .toLocaleLowerCase("vi")
          .includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [categoryId, data, search]);

  if (loading) {
    return (
      <div className="min-h-[600px] bg-[#F7F7F4] px-4 py-16">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-40 rounded-3xl bg-gray-200" />

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-96 rounded-2xl bg-gray-200"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[600px] bg-[#F7F7F4] px-4 py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-gray-900">
            Không thể tải thiết bị
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => void load()}
            className="mt-6 rounded-xl bg-[#1B5E41] px-5 py-3 text-sm font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!data.eligibility.eligible) {
    return (
      <div className="min-h-[600px] bg-[#F7F7F4] px-4 py-20">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-gray-900">
            Chưa thể thuê thiết bị
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {data.eligibility.reason ??
              "Booking hiện tại chưa đủ điều kiện thuê đồ."}
          </p>

          <Link
            href="/my-trips"
            className="mt-6 inline-flex rounded-xl bg-[#1B5E41] px-5 py-3 text-sm font-bold text-white"
          >
            Xem chuyến đi của tôi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F4]">
      <section className="bg-[#153E2E] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-emerald-200">
              <Link href="/" className="hover:text-white">
                Trang chủ
              </Link>
              <span>/</span>
              <span>Thuê thiết bị</span>
            </div>

            <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              U01 · Rental catalog
            </span>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Chuẩn bị thiết bị cho chuyến đi
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">
              Thiết bị được kiểm tra tồn kho và gợi ý dựa
              trên lịch trình, độ khó và điều kiện thời tiết
              của chuyến đi.
            </p>
          </div>

          <div className="min-w-[280px] rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              Chuyến đi đang áp dụng
            </p>

            <p className="mt-2 text-lg font-extrabold">
              {data.eligibility.trip.name}
            </p>

            <p className="mt-3 text-xs leading-5 text-emerald-50/80">
              Hạn thuê:{" "}
              {formatDate(data.eligibility.rentalCutoffAt)}
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Tìm lều, balo, túi ngủ..."
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-sm outline-none transition focus:border-[#1B5E41] focus:bg-white"
              />
            </div>

            <div className="text-sm font-semibold text-gray-600">
              {filteredItems.length} thiết bị phù hợp
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                categoryId === "all"
                  ? "bg-[#1B5E41] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Tất cả
            </button>

            {data.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  categoryId === category.id
                    ? "bg-[#1B5E41] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </section>

        {filteredItems.length > 0 ? (
          <section className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                bookingId={bookingId}
              />
            ))}
          </section>
        ) : (
          <section className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <h2 className="text-lg font-extrabold text-gray-900">
              Không tìm thấy thiết bị
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Thử đổi từ khóa hoặc chọn danh mục khác.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}