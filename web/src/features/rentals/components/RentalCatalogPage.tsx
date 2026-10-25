/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRentalCart } from "@/features/rentals/hooks/useRentalCart";
import { getRentalCatalog } from "@/features/rentals/services/rental.api";
import type {
  RentalCatalogData,
  RentalCatalogItem,
} from "@/features/rentals/types/rental";

type RentalCatalogPageProps = { bookingId: string };

function formatMoney(value: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
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
  const clean = value
    .replace(/\s+(?:[0-9a-f]{7,}|[a-z]+_[0-9a-f]{6,})$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return (
    CATEGORY_ALIASES.find(([pattern]) => pattern.test(clean))?.[1] ??
    (clean || "Khác")
  );
}

function categoryKey(value: string) {
  return cleanCategoryName(value).toLocaleLowerCase("vi");
}

function CartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path
        d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function QuantityControl({
  quantity,
  maximum,
  onChange,
  compact = false,
}: {
  quantity: number;
  maximum: number;
  onChange: (quantity: number) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center overflow-hidden rounded-xl border border-emerald-800/15 bg-white ${compact ? "h-9" : "h-11"}`}
    >
      <button
        type="button"
        aria-label="Giảm số lượng"
        onClick={() => onChange(quantity - 1)}
        className="grid h-full w-10 place-items-center text-lg font-black text-[#174B36] transition hover:bg-emerald-50"
      >
        −
      </button>
      <span className="grid h-full min-w-10 place-items-center border-x border-emerald-800/10 text-sm font-black text-gray-950">
        {quantity}
      </span>
      <button
        type="button"
        aria-label="Tăng số lượng"
        disabled={quantity >= maximum}
        onClick={() => onChange(quantity + 1)}
        className="grid h-full w-10 place-items-center text-lg font-black text-[#174B36] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-gray-300"
      >
        +
      </button>
    </div>
  );
}

function ProductCard({
  item,
  bookingId,
  quantity,
  onQuantityChange,
}: {
  item: RentalCatalogItem;
  bookingId: string;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
}) {
  const availableCount = item.availableCount ?? 0;
  const checking = item.availableCount === null;
  const detailUrl = `/rental-products/${encodeURIComponent(item.id)}?bookingId=${encodeURIComponent(bookingId)}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-[#DDE8DF] bg-white shadow-[0_8px_28px_rgba(22,63,45,0.07)] transition duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[0_18px_42px_rgba(22,63,45,0.14)]">
      <Link
        href={detailUrl}
        className="relative block aspect-[1.14/1] overflow-hidden bg-[#EEF3EF]"
      >
        {item.imageUrls[0] ? (
          <img
            src={item.imageUrls[0]}
            alt={item.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,#e7f3e8,#f3f5ef)] text-[#668071]">
            <span className="text-4xl">🏕️</span>
            <span className="text-xs font-bold">Đang cập nhật ảnh</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
        {item.recommendation && (
          <span className="absolute left-3 top-3 rounded-full bg-[#F7C846] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#493500] shadow-sm">
            ✦ Hợp chuyến đi
          </span>
        )}
        <span
          className={`absolute bottom-3 right-3 rounded-full px-3 py-1.5 text-[10px] font-black shadow-sm backdrop-blur ${checking ? "bg-sky-700/90 text-white" : availableCount > 0 ? "bg-white/95 text-[#17603F]" : "bg-gray-900/85 text-white"}`}
        >
          {checking
            ? "Đang kiểm tra"
            : availableCount > 0
              ? `Còn ${availableCount}`
              : "Tạm hết"}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
          {cleanCategoryName(item.category.name)}
        </p>
        <Link
          href={detailUrl}
          className="mt-2 line-clamp-2 min-h-12 text-base font-black leading-6 text-[#17251D] transition hover:text-emerald-700"
        >
          {item.name}
        </Link>
        {item.sku && (
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            SKU {item.sku}
          </p>
        )}
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-gray-500">
          {item.description}
        </p>
        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-400">
                Giá thuê từ
              </p>
              <p className="mt-0.5 text-xl font-black text-[#17603F]">
                {formatMoney(item.dailyPrice, item.currency)}
                <span className="text-[11px] font-bold text-gray-400">
                  /ngày
                </span>
              </p>
            </div>
            <Link
              href={detailUrl}
              className="text-xs font-bold text-gray-500 underline decoration-gray-300 underline-offset-4 hover:text-emerald-700"
            >
              Chi tiết
            </Link>
          </div>
          <div className="mt-4">
            {quantity > 0 ? (
              <div className="flex items-center justify-between rounded-2xl bg-[#EEF7EE] p-2">
                <span className="pl-1 text-xs font-black text-[#174B36]">
                  Đã chọn
                </span>
                <QuantityControl
                  quantity={quantity}
                  maximum={availableCount}
                  onChange={onQuantityChange}
                  compact
                />
              </div>
            ) : (
              <button
                type="button"
                disabled={checking || availableCount < 1}
                onClick={() => onQuantityChange(1)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#174B36] text-sm font-black text-white shadow-[0_8px_18px_rgba(23,75,54,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0F5A3B] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
              >
                <span className="text-lg">+</span>
                {checking
                  ? "Đang kiểm tra tồn kho"
                  : availableCount > 0
                    ? "Thêm vào giỏ thuê"
                    : "Thiết bị tạm hết"}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function RentalCatalogPage({ bookingId }: RentalCatalogPageProps) {
  const [data, setData] = useState<RentalCatalogData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [cartOpen, setCartOpen] = useState(false);
  const categoryRailRef = useRef<HTMLDivElement | null>(null);
  const cart = useRentalCart(bookingId);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        setData(await getRentalCatalog(bookingId, signal));
      } catch (loadError) {
        if (!signal?.aborted)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải danh sách thiết bị.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [bookingId],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const categories = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; count: number }
    >();
    data?.items.forEach((item) => {
      const key = categoryKey(item.category.name);
      groups.set(key, {
        key,
        label: cleanCategoryName(item.category.name),
        count: (groups.get(key)?.count ?? 0) + 1,
      });
    });
    return [...groups.values()].sort((a, b) =>
      a.label.localeCompare(b.label, "vi"),
    );
  }, [data]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (data?.items ?? []).filter(
      (item) =>
        (activeCategory === "all" ||
          categoryKey(item.category.name) === activeCategory) &&
        (!keyword ||
          `${item.name} ${item.description} ${item.sku ?? ""}`
            .toLocaleLowerCase("vi")
            .includes(keyword)),
    );
  }, [activeCategory, data, search]);

  if (loading)
    return (
      <div className="min-h-[650px] bg-[#F4F6F1] px-4 py-12">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-48 rounded-[28px] bg-emerald-950/15" />
          <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-[420px] rounded-3xl bg-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );

  if (error || !data)
    return (
      <div className="min-h-[600px] bg-[#F4F6F1] px-4 py-20">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-black text-gray-950">
            Không thể tải thiết bị
          </h1>
          <p className="mt-3 text-sm text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-6 rounded-xl bg-[#174B36] px-5 py-3 text-sm font-black text-white"
          >
            Thử lại
          </button>
        </div>
      </div>
    );

  if (!data.eligibility.eligible)
    return (
      <div className="min-h-[600px] bg-[#F4F6F1] px-4 py-20">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-2xl">
            ⛰️
          </div>
          <h1 className="mt-4 text-xl font-black text-gray-950">
            Chuyến đi chưa thể thuê thiết bị
          </h1>
          <p className="mt-3 text-sm text-gray-600">
            {data.eligibility.reason ??
              "Chuyến đi hiện chưa đủ điều kiện thuê đồ."}
          </p>
          <Link
            href="/my-trips"
            className="mt-6 inline-flex rounded-xl bg-[#174B36] px-5 py-3 text-sm font-black text-white"
          >
            Xem chuyến đi của tôi
          </Link>
        </div>
      </div>
    );

  const checkoutUrl = `/rentals/quote?bookingId=${encodeURIComponent(bookingId)}`;

  return (
    <div className="min-h-screen bg-[#F4F6F1] pb-28">
      <section className="relative overflow-hidden bg-[#123D2C] text-white">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_80%_20%,#b9e769_0,transparent_28%),linear-gradient(120deg,transparent_55%,#2d7657_55%,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8 lg:py-12">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">
              TrekGo Gear Station
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight sm:text-4xl">
              Chọn hành trang, sẵn sàng lên đường
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/75">
              Thêm nhiều thiết bị vào cùng một giỏ thuê. TrekGo sẽ kiểm tra tồn
              kho, tiền cọc và lịch nhận trả trước khi thanh toán.
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300">
              Chuyến đi đang chọn
            </p>
            <p className="mt-2 text-lg font-black">
              {data.eligibility.trip.name}
            </p>
            <p className="mt-3 text-xs leading-5 text-emerald-50/75">
              Có thể thuê đến {formatDate(data.eligibility.rentalCutoffAt)}
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <section className="rounded-[24px] border border-emerald-900/10 bg-white p-4 shadow-[0_10px_30px_rgba(22,63,45,0.07)]">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="relative block">
              <span className="sr-only">Tìm thiết bị</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm lều, balo, túi ngủ, mã SKU..."
                className="h-14 w-full rounded-2xl border border-gray-200 bg-[#F7F8F5] py-3.5 pl-12 pr-4 text-sm font-medium outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
            </label>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="flex h-14 items-center justify-between gap-4 rounded-2xl bg-[#174B36] px-5 py-3 text-white shadow-lg shadow-emerald-950/10"
            >
              <span className="flex items-center gap-3">
                <CartIcon />
                <span className="text-left">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                    Giỏ hành trang
                  </span>
                  <span className="block text-sm font-black">
                    {cart.totalQuantity} thiết bị
                  </span>
                </span>
              </span>
              <span className="rounded-full bg-lime-300 px-2.5 py-1 text-xs font-black text-[#123D2C]">
                {cart.totalQuantity}
              </span>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                categoryRailRef.current?.scrollBy({
                  left: -320,
                  behavior: "smooth",
                })
              }
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-gray-200 text-emerald-800 hover:bg-emerald-50 sm:grid"
            >
              ‹
            </button>
            <div
              ref={categoryRailRef}
              className="flex flex-1 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {[
                { key: "all", label: "Tất cả", count: data.items.length },
                ...categories,
              ].map((category) => (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => setActiveCategory(category.key)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-black transition ${activeCategory === category.key ? "border-[#174B36] bg-[#174B36] text-white" : "border-gray-200 bg-white text-gray-600 hover:border-emerald-400 hover:text-emerald-800"}`}
                >
                  {category.label}{" "}
                  <span className="ml-1 opacity-60">{category.count}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                categoryRailRef.current?.scrollBy({
                  left: 320,
                  behavior: "smooth",
                })
              }
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-gray-200 text-emerald-800 hover:bg-emerald-50 sm:grid"
            >
              ›
            </button>
          </div>
        </section>

        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
              Danh mục thiết bị
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#17251D]">
              Trang bị cho chuyến đi
            </h2>
          </div>
          <p className="text-sm font-bold text-gray-500">
            {filteredItems.length} sản phẩm
          </p>
        </div>
        {filteredItems.length ? (
          <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => {
              const cartItem = cart.items.find(
                (entry) => entry.product.id === item.id,
              );
              return (
                <ProductCard
                  key={item.id}
                  item={item}
                  bookingId={bookingId}
                  quantity={cartItem?.quantity ?? 0}
                  onQuantityChange={(quantity) =>
                    cart.setQuantity(item, item.availableCount ?? 0, quantity)
                  }
                />
              );
            })}
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="text-4xl">🧭</div>
            <h2 className="mt-3 text-lg font-black text-gray-900">
              Chưa tìm thấy thiết bị phù hợp
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Thử đổi từ khóa hoặc chọn một danh mục khác.
            </p>
          </section>
        )}
      </main>

      {cart.hydrated && cart.totalQuantity > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-900/10 bg-white/95 shadow-[0_-12px_35px_rgba(20,61,44,0.14)] backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E5F2E6] text-[#174B36]"
            >
              <CartIcon />
              <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-[#F7C846] px-1 text-[10px] font-black text-gray-950">
                {cart.totalQuantity}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-black text-gray-950">
                {cart.totalQuantity} thiết bị cho {data.eligibility.trip.name}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">
                Tạm tính {formatMoney(cart.dailyTotal)}/ngày · Xem và chỉnh giỏ
              </p>
            </button>
            <Link
              href={checkoutUrl}
              className="rounded-2xl bg-[#174B36] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-950/15 transition hover:bg-[#0F5A3B]"
            >
              Kiểm tra & đặt thuê <span className="hidden sm:inline">→</span>
            </Link>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Đóng giỏ hàng"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-emerald-950/45 backdrop-blur-[2px]"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-[#F7F8F5] shadow-2xl">
            <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Giỏ hành trang
                </p>
                <h2 className="mt-1 text-xl font-black text-gray-950">
                  Thiết bị đã chọn
                </h2>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setCartOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-gray-200 text-xl text-gray-600 hover:bg-gray-50"
              >
                ×
              </button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {cart.items.length === 0 ? (
                <div className="mt-24 text-center">
                  <div className="text-5xl">🎒</div>
                  <p className="mt-4 font-black text-gray-900">
                    Giỏ hành trang đang trống
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Bấm dấu + trên từng thiết bị để thêm.
                  </p>
                </div>
              ) : (
                cart.items.map(({ product, quantity, availableCount }) => (
                  <div
                    key={product.id}
                    className="flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#EEF3EF]">
                      {product.imageUrls[0] ? (
                        <img
                          src={product.imageUrls[0]}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-2xl">
                          🏕️
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-black text-gray-950">
                        {product.name}
                      </p>
                      <p className="mt-1 text-xs font-black text-emerald-700">
                        {formatMoney(product.dailyPrice, product.currency)}/ngày
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <QuantityControl
                          quantity={quantity}
                          maximum={availableCount}
                          onChange={(next) =>
                            cart.setQuantity(product, availableCount, next)
                          }
                          compact
                        />
                        <button
                          type="button"
                          onClick={() =>
                            cart.setQuantity(product, availableCount, 0)
                          }
                          className="text-xs font-bold text-red-600 hover:underline"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.items.length > 0 && (
              <footer className="border-t border-gray-200 bg-white p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500">
                      Tạm tính mỗi ngày
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#174B36]">
                      {formatMoney(cart.dailyTotal)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cart.clear}
                    className="text-xs font-bold text-gray-500 hover:text-red-600"
                  >
                    Xóa giỏ
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-gray-500">
                  Phí thuê chính xác và tiền cọc sẽ được Backend tính theo lịch
                  chuyến đi.
                </p>
                <Link
                  href={checkoutUrl}
                  className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#174B36] px-5 py-4 text-sm font-black text-white shadow-lg shadow-emerald-950/15"
                >
                  Kiểm tra tồn kho & tiếp tục →
                </Link>
              </footer>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
