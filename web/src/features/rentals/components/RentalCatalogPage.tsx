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

  return alias?.[1] ?? (withoutTestSuffix || "Khác");
}

function getCategoryKey(value: string) {
  return cleanCategoryName(value).toLocaleLowerCase("vi");
}

function TrailCardEffect() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-3xl bg-emerald-950/10 backdrop-blur-[1px] motion-reduce:hidden"
    >
      <svg
        viewBox="0 0 420 320"
        preserveAspectRatio="none"
        className="h-full w-full"
        fill="none"
      >
        <path
          d="M-15 285C70 235 65 155 151 178C232 199 218 82 310 112C354 126 374 67 438 42"
          className="trail-click-route"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="12 12"
        />

        <g className="trail-click-step trail-click-step-one">
          <ellipse cx="86" cy="221" rx="7" ry="12" fill="#ECFDF5" />
          <circle cx="82" cy="205" r="3" fill="#ECFDF5" />
          <circle cx="88" cy="203" r="3" fill="#ECFDF5" />
        </g>

        <g className="trail-click-step trail-click-step-two">
          <ellipse cx="168" cy="171" rx="7" ry="12" fill="#ECFDF5" />
          <circle cx="164" cy="155" r="3" fill="#ECFDF5" />
          <circle cx="170" cy="153" r="3" fill="#ECFDF5" />
        </g>

        <g className="trail-click-step trail-click-step-three">
          <ellipse cx="265" cy="112" rx="7" ry="12" fill="#ECFDF5" />
          <circle cx="261" cy="96" r="3" fill="#ECFDF5" />
          <circle cx="267" cy="94" r="3" fill="#ECFDF5" />
        </g>

        <g className="trail-click-checkpoint">
          <circle cx="354" cy="71" r="27" fill="#D9F99D" />
          <path
            d="m337 82 13-21 8 12 7-10 12 19h-40Z"
            fill="#166534"
          />
          <path d="M354 49v18" stroke="#166534" strokeWidth="4" />
          <path d="m354 49 13 5-13 6V49Z" fill="#F59E0B" />
        </g>
      </svg>

      <div className="trail-click-label absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/40 bg-[#153E2E]/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg">
        Lên đường khám phá
      </div>

      <style jsx global>{`
        .trail-click-route {
          stroke-dashoffset: 220;
          animation: trail-route-draw 540ms ease-out forwards;
          filter: drop-shadow(0 3px 5px rgb(6 78 59 / 0.45));
        }

        .trail-click-step {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation: trail-step-pop 240ms ease-out forwards;
        }

        .trail-click-step-one {
          animation-delay: 80ms;
        }

        .trail-click-step-two {
          animation-delay: 190ms;
        }

        .trail-click-step-three {
          animation-delay: 300ms;
        }

        .trail-click-checkpoint {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation: trail-checkpoint-pop 300ms cubic-bezier(0.16, 1, 0.3, 1)
            340ms forwards;
        }

        .trail-click-label {
          opacity: 0;
          animation: trail-label-rise 280ms ease-out 230ms forwards;
        }

        @keyframes trail-route-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes trail-step-pop {
          0% {
            opacity: 0;
            transform: scale(0.4) rotate(-18deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(8deg);
          }
        }

        @keyframes trail-checkpoint-pop {
          0% {
            opacity: 0;
            transform: scale(0.25) translateY(16px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes trail-label-rise {
          from {
            opacity: 0;
            transform: translate(-50%, 10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
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
  const [trailEffectKey, setTrailEffectKey] = useState(0);
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

  const openWithTrailEffect = (event: MouseEvent<HTMLAnchorElement>) => {
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
    setTrailEffectKey((current) => current + 1);

    if (navigationTimer.current) {
      clearTimeout(navigationTimer.current);
    }

    navigationTimer.current = setTimeout(() => {
      router.push(detailUrl);
    }, 520);
  };

  return (
    <div className="relative h-full rounded-3xl shadow-[0_14px_38px_rgba(16,185,129,0.20)] transition duration-300 hover:shadow-[0_22px_52px_rgba(5,150,105,0.30)]">
      {trailEffectKey > 0 && <TrailCardEffect key={trailEffectKey} />}

      <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-emerald-700/15 bg-white transition duration-300 hover:-translate-y-1 hover:border-emerald-600/35">
      <Link
        href={detailUrl}
        onClick={openWithTrailEffect}
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

        <Link href={detailUrl} onClick={openWithTrailEffect}>
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
            onClick={openWithTrailEffect}
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categoryRailRef = useRef<HTMLDivElement | null>(null);

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

  const scrollCategories = (direction: "left" | "right") => {
    categoryRailRef.current?.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

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
        <section className="overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-[0_12px_35px_rgba(21,62,46,0.08)]">
          <div className="grid gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-700/60"
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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm lều, balo, túi ngủ..."
                className="h-14 w-full rounded-2xl border border-emerald-900/10 bg-[#F6F9F6] pl-12 pr-4 text-sm outline-none transition focus:border-emerald-600/40 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              aria-expanded={filtersOpen}
              className="group flex h-14 min-w-[230px] items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#153E2E] to-[#247653] px-4 text-left text-white shadow-[0_10px_24px_rgba(21,62,46,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(21,62,46,0.30)]"
            >
              <span className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime-300 text-[#153E2E] shadow-inner">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 19 10 8l3 5 2-3 5 9H4Z" strokeLinejoin="round" />
                    <path d="M12 4v4M12 4l4 2-4 2" strokeLinecap="round" />
                  </svg>
                </span>

                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/75">
                    Túi lọc hành trang
                  </span>
                  <span className="mt-0.5 block text-sm font-extrabold">
                    {filteredItems.length} thiết bị phù hợp
                  </span>
                </span>
              </span>

              <svg
                viewBox="0 0 24 24"
                className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
                  filtersOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div
            className={`grid border-emerald-900/10 bg-gradient-to-r from-[#F1F7F2] via-white to-[#F6FAEC] transition-all duration-300 ${
              filtersOpen
                ? "grid-rows-[1fr] border-t opacity-100"
                : "grid-rows-[0fr] border-t-0 opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  type="button"
                  onClick={() => scrollCategories("left")}
                  aria-label="Kéo danh mục sang trái"
                  className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-900/10 bg-white text-[#153E2E] shadow-sm transition hover:bg-lime-100 sm:grid"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <div
                  ref={categoryRailRef}
                  className="flex flex-1 snap-x snap-mandatory gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <button
                    type="button"
                    onClick={() => setCategoryKey("all")}
                    className={`shrink-0 snap-start rounded-2xl border px-4 py-2.5 text-xs font-extrabold transition ${
                      categoryKey === "all"
                        ? "border-[#153E2E] bg-[#153E2E] text-white shadow-md"
                        : "border-emerald-900/10 bg-white text-gray-700 hover:border-emerald-500/30 hover:bg-lime-50"
                    }`}
                  >
                    Tất cả hành trang
                    <span className="ml-2 opacity-65">{data.items.length}</span>
                  </button>

                  {categoryFilters.map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setCategoryKey(category.key)}
                      className={`shrink-0 snap-start rounded-2xl border px-4 py-2.5 text-xs font-extrabold transition ${
                        categoryKey === category.key
                          ? "border-emerald-700 bg-emerald-700 text-white shadow-md"
                          : "border-emerald-900/10 bg-white text-gray-700 hover:border-emerald-500/30 hover:bg-lime-50"
                      }`}
                    >
                      {category.label}
                      <span className="ml-2 opacity-65">{category.count}</span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => scrollCategories("right")}
                  aria-label="Kéo danh mục sang phải"
                  className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-900/10 bg-white text-[#153E2E] shadow-sm transition hover:bg-lime-100 sm:grid"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
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