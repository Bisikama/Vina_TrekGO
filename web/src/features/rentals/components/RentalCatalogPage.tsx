/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

const CATEGORY_ALIASES: Array<[RegExp, string]> = [
  [/^(bags?|backpacks?|balo)/i, "Balo"],
  [/^(tents?|lều)/i, "Lều"],
  [/^(sleeping bags?|túi ngủ)/i, "Túi ngủ"],
  [/^(trekking poles?|gậy)/i, "Gậy trekking"],
  [/^(camping)/i, "Dụng cụ cắm trại"],
  [/^(hotfix cat)/i, "Khác"],
];

function cleanCategoryName(value: string) {
  const withoutTestSuffix = value
    .replace(/\s+(?:[0-9a-f]{7,}|[a-z]+_[0-9a-f]{6,})$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const alias = CATEGORY_ALIASES.find(([pattern]) =>
    pattern.test(withoutTestSuffix),
  );

  return alias?.[1] ?? withoutTestSuffix || "Khác";
}

function getCategoryKey(value: string) {
  return cleanCategoryName(value).toLocaleLowerCase("vi");
}

function NatureBurst() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 motion-reduce:hidden"
    >
      {[0, 1, 2, 3, 4, 5].map((piece) => (
        <span
          key={piece}
          className="rental-nature-piece absolute left-1/2 top-1/2 h-7 w-7 text-emerald-500"
        >
          {piece % 3 === 1 ? (
            <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
              <circle cx="12" cy="6.5" r="3.5" fill="currentColor" />
              <circle cx="17.5" cy="11.5" r="3.5" fill="currentColor" />
              <circle cx="12" cy="17" r="3.5" fill="currentColor" />
              <circle cx="6.5" cy="11.5" r="3.5" fill="currentColor" />
              <circle cx="12" cy="11.8" r="2.3" className="fill-amber-300" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-full w-full" fill="none">
              <path
                d="M20.2 3.8C12.6 4 6.4 7.2 4.1 13.2c-1 2.7.4 5.8 3.4 6.5 5.9 1.4 11.6-4.9 12.7-15.9Z"
                fill="currentColor"
              />
              <path
                d="M5.6 18.5c3.2-4.2 6.8-7.1 11.2-9.2"
                stroke="white"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
      ))}

      <style jsx global>{`
        .rental-nature-piece {
          opacity: 0;
          filter: drop-shadow(0 4px 5px rgb(20 83 45 / 0.18));
          animation: rental-nature-burst 620ms cubic-bezier(0.16, 1, 0.3, 1)
            forwards;
        }

        .rental-nature-piece:nth-child(1) {
          --burst-x: -150px;
          --burst-y: -118px;
          --burst-rotate: -32deg;
        }

        .rental-nature-piece:nth-child(2) {
          --burst-x: 18px;
          --burst-y: -155px;
          --burst-rotate: 18deg;
          color: #f59e0b;
          animation-delay: 35ms;
        }

        .rental-nature-piece:nth-child(3) {
          --burst-x: 150px;
          --burst-y: -88px;
          --burst-rotate: 44deg;
          color: #22c55e;
          animation-delay: 70ms;
        }

        .rental-nature-piece:nth-child(4) {
          --burst-x: 148px;
          --burst-y: 92px;
          --burst-rotate: 72deg;
          color: #fb7185;
          animation-delay: 25ms;
        }

        .rental-nature-piece:nth-child(5) {
          --burst-x: -8px;
          --burst-y: 150px;
          --burst-rotate: 112deg;
          color: #10b981;
          animation-delay: 65ms;
        }

        .rental-nature-piece:nth-child(6) {
          --burst-x: -148px;
          --burst-y: 82px;
          --burst-rotate: -78deg;
          color: #65a30d;
          animation-delay: 45ms;
        }

        @keyframes rental-nature-burst {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.2) rotate(0deg);
          }
          22% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(
                calc(-50% + var(--burst-x)),
                calc(-50% + var(--burst-y))
              )
              scale(1) rotate(var(--burst-rotate));
          }
        }
      `}</style>
    </div>
  );
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
  const router = useRouter();
  const imageUrl = item.imageUrls[0];
  const available = item.availableCount > 0;
  const [burstKey, setBurstKey] = useState(0);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detailUrl = `/rental-products/${encodeURIComponent(
    item.id,
  )}?bookingId=${encodeURIComponent(bookingId)}`;

  useEffect(
    () => () => {
      if (navigationTimer.current) {
        clearTimeout(navigationTimer.current);
      }
    },
    [],
  );

  const openWithNatureBurst = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    setBurstKey((current) => current + 1);

    if (navigationTimer.current) {
      clearTimeout(navigationTimer.current);
    }

    navigationTimer.current = setTimeout(() => {
      router.push(detailUrl);
    }, 520);
  };

  return (
    <div className="relative h-full">
      {burstKey > 0 && <NatureBurst key={burstKey} />}

      <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-emerald-950/10 bg-white shadow-[0_12px_38px_rgba(21,62,46,0.08)] transition duration-300 hover:-translate-y-1 hover:border-emerald-700/25 hover:shadow-[0_20px_46px_rgba(21,62,46,0.14)]">
      <Link
        href={detailUrl}
        onClick={openWithNatureBurst}
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
            {cleanCategoryName(item.category.name)}
          </span>
        </div>

        <Link href={detailUrl} onClick={openWithNatureBurst}>
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
            onClick={openWithNatureBurst}
            className="rounded-xl bg-[#1B5E41] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#154B36]"
          >
            Xem chi tiết
          </Link>
        </div>
      </div>
      </article>
    </div>
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
  const [categoryKey, setCategoryKey] = useState("all");

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

  const categoryFilters = useMemo(() => {
    if (!data) {
      return [];
    }

    const groups = new Map<
      string,
      { key: string; label: string; count: number }
    >();

    data.items.forEach((item) => {
      const label = cleanCategoryName(item.category.name);
      const key = getCategoryKey(item.category.name);
      const current = groups.get(key);

      groups.set(key, {
        key,
        label,
        count: (current?.count ?? 0) + 1,
      });
    });

    return Array.from(groups.values()).sort((left, right) =>
      left.label.localeCompare(right.label, "vi"),
    );
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!data) {
      return [];
    }

    const keyword = search.trim().toLocaleLowerCase("vi");

    return data.items.filter((item) => {
      const matchesCategory =
        categoryKey === "all" ||
        getCategoryKey(item.category.name) === categoryKey;

      const matchesSearch =
        !keyword ||
        item.name.toLocaleLowerCase("vi").includes(keyword) ||
        item.description
          .toLocaleLowerCase("vi")
          .includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [categoryKey, data, search]);

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

          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">
              Danh mục đang có thiết bị
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setCategoryKey("all")}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                  categoryKey === "all"
                    ? "bg-[#1B5E41] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-[#1B5E41]"
                }`}
              >
                Tất cả
                <span className="ml-2 opacity-70">{data.items.length}</span>
              </button>

              {categoryFilters.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => setCategoryKey(category.key)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                    categoryKey === category.key
                      ? "bg-[#1B5E41] text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-[#1B5E41]"
                  }`}
                >
                  {category.label}
                  <span className="ml-2 opacity-70">{category.count}</span>
                </button>
              ))}
            </div>
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