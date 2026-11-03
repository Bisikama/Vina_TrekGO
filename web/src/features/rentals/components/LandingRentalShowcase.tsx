/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/features/auth";
import {
  getRentalCategories,
  getRentalProducts,
} from "@/features/rentals/services/rental.api";
import type {
  RentalCategory,
  RentalProduct,
} from "@/features/rentals/types/rental";

// Khu "Đồ cho thuê" trên trang chủ: ai cũng xem được danh mục.
// Chưa đăng nhập mà bấm vào món đồ → hộp nhắc đăng nhập; đã đăng nhập → sang trang Thuê đồ.

const PAGE_SIZE = 50;
const MAX_PAGES = 6;
const INITIAL_VISIBLE = 8;
const GRADE_LABELS = { LIKE_NEW: "Như mới", GOOD_USED: "Sử dụng tốt" } as const;
const GRADE_ORDER = { LIKE_NEW: 0, GOOD_USED: 1 } as const;
const RENTALS_PATH = "/rentals";
const LOGIN_PATH = "/public/login";
const REGISTER_PATH = "/public/register";

type ProductGroup = { key: string; name: string; variants: RentalProduct[] };

function formatMoney(value: number, currency = "VND") {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function gradeFamilyName(name: string) {
  return name
    .replace(/\s*[-–—:]\s*(rất mới|mới|đã sử dụng tốt|sử dụng tốt|đã qua sử dụng)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function groupProducts(items: RentalProduct[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();
  items.forEach((item) => {
    const key = item.gradeGroupId ? `grade:${item.gradeGroupId}` : item.id;
    const current = groups.get(key);
    if (current) current.variants.push(item);
    else
      groups.set(key, {
        key,
        name: item.gradeGroupId ? gradeFamilyName(item.name) : item.name,
        variants: [item],
      });
  });
  groups.forEach((group) =>
    group.variants.sort(
      (a, b) =>
        (a.grade ? GRADE_ORDER[a.grade] : 9) - (b.grade ? GRADE_ORDER[b.grade] : 9),
    ),
  );
  return [...groups.values()];
}

async function loadAllProducts(signal: AbortSignal) {
  const first = await getRentalProducts({ page: 1, pageSize: PAGE_SIZE, signal });
  const items = [...first.items];
  const totalPages = Math.min(first.pagination?.totalPages ?? 1, MAX_PAGES);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await getRentalProducts({ page, pageSize: PAGE_SIZE, signal });
    items.push(...next.items);
  }
  return items;
}

function ShowcaseCard({
  group,
  selectedId,
  onSelectVariant,
  onOpen,
}: {
  group: ProductGroup;
  selectedId?: string;
  onSelectVariant: (id: string) => void;
  onOpen: (product: RentalProduct) => void;
}) {
  const item = group.variants.find((variant) => variant.id === selectedId) ?? group.variants[0];
  const gradeVariants = group.variants.filter((variant) => variant.grade);
  const image = item.imageUrls[0];

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-[#DDE8DF] bg-white shadow-[0_8px_28px_rgba(22,63,45,0.07)] transition duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[0_18px_42px_rgba(22,63,45,0.14)]">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="relative block aspect-[1.14/1] w-full overflow-hidden bg-[#EEF3EF] text-left"
        aria-label={`Xem ${item.name}`}
      >
        {image ? (
          <img
            src={image}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,#e7f3e8,#f3f5ef)] text-[#668071]">
            <span className="text-4xl">🏕️</span>
            <span className="text-xs font-bold">Đang cập nhật ảnh</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
        {item.grade && (
          <span
            className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm backdrop-blur ${item.grade === "LIKE_NEW" ? "bg-white/95 text-[#17603F]" : "bg-[#FFF6E0]/95 text-[#8A5A00]"}`}
          >
            {GRADE_LABELS[item.grade]}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
          {item.category.name}
        </p>
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="mt-2 line-clamp-2 min-h-12 text-left text-base font-black leading-6 text-[#17251D] transition hover:text-emerald-700"
        >
          {group.name}
        </button>
        {gradeVariants.length > 1 && (
          <div
            role="radiogroup"
            aria-label="Chọn tình trạng"
            className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[#EEF3EF] p-1"
          >
            {gradeVariants.map((variant) => {
              const selected = variant.id === item.id;
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelectVariant(variant.id)}
                  className={`h-8 rounded-lg text-xs font-bold transition ${selected ? "bg-white text-[#174B36] shadow-sm" : "text-gray-500 hover:text-[#174B36]"}`}
                >
                  {variant.grade ? GRADE_LABELS[variant.grade] : variant.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-gray-500">
          {item.description}
        </p>
        <div className="mt-auto pt-4">
          <p className="text-[10px] font-semibold text-gray-400">Giá thuê từ</p>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xl font-black text-[#17603F]">
            <span>
              {formatMoney(item.dailyPrice, item.currency)}
              <span className="text-[11px] font-bold text-gray-400">/ngày</span>
            </span>
            {(item.replacementValue ?? 0) > 0 && (
              <span title="Giá gốc của món đồ" className="text-xs font-semibold text-gray-400 line-through opacity-80">
                {formatMoney(item.replacementValue ?? 0, item.currency)}
              </span>
            )}
          </p>
          {typeof item.depositPerUnit === "number" && (
            <p className="mt-1 text-[11px] font-semibold text-gray-500">
              Cọc {formatMoney(item.depositPerUnit, item.currency)}/món
            </p>
          )}
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#174B36] text-sm font-black text-white shadow-[0_8px_18px_rgba(23,75,54,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0F5A3B]"
          >
            <span className="text-lg">+</span>
            Thuê ngay
          </button>
        </div>
      </div>
    </article>
  );
}

function LoginPromptDialog({
  product,
  onClose,
}: {
  product: RentalProduct;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const redirect = encodeURIComponent(RENTALS_PATH);

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rental-login-title"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-4 bg-[#EAF4ED] p-5">
          {product.imageUrls[0] && (
            <img
              src={product.imageUrls[0]}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#2F6B4F]">
              Thuê đồ trekking
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-bold text-[#17251D]">{product.name}</p>
          </div>
        </div>
        <div className="p-6">
          <h3 id="rental-login-title" className="text-xl font-black text-[#17251D]">
            Đăng nhập để thuê đồ
          </h3>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Đồ thuê được gắn với chuyến đi của bạn để kiểm tra còn hàng, tính cọc và giao nhận đúng ngày.
            Đăng nhập hoặc tạo tài khoản miễn phí để tiếp tục.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link
              href={`${LOGIN_PATH}?redirect=${redirect}`}
              className="flex h-11 items-center justify-center rounded-2xl bg-[#174B36] text-sm font-black text-white transition hover:bg-[#0F5A3B]"
            >
              Đăng nhập
            </Link>
            <Link
              href={`${REGISTER_PATH}?redirect=${redirect}`}
              className="flex h-11 items-center justify-center rounded-2xl border border-[#174B36]/20 text-sm font-black text-[#174B36] transition hover:bg-emerald-50"
            >
              Đăng ký
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full text-xs font-bold text-gray-400 hover:text-gray-600"
          >
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
}

export function LandingRentalShowcase() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const [products, setProducts] = useState<RentalProduct[]>([]);
  const [categories, setCategories] = useState<RentalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [promptProduct, setPromptProduct] = useState<RentalProduct | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      loadAllProducts(controller.signal),
      getRentalCategories(controller.signal).catch(() => ({ items: [] as RentalCategory[] })),
    ])
      .then(([items, categoryResult]) => {
        setProducts(items);
        setCategories(categoryResult.items);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Không thể tải danh sách đồ cho thuê.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const groups = useMemo(() => groupProducts(products), [products]);

  const categoryChips = useMemo(() => {
    const counts = new Map<string, number>();
    groups.forEach((group) => {
      const id = group.variants[0].category.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    const known = new Map(categories.map((category) => [category.id, category.name]));
    groups.forEach((group) => {
      const category = group.variants[0].category;
      if (!known.has(category.id)) known.set(category.id, category.name);
    });
    return [...counts.entries()]
      .map(([id, count]) => ({ id, name: known.get(id) ?? "Khác", count }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [groups, categories]);

  const filtered = useMemo(
    () =>
      activeCategory === "all"
        ? groups
        : groups.filter((group) => group.variants[0].category.id === activeCategory),
    [groups, activeCategory],
  );

  const openProduct = (product: RentalProduct) => {
    if (isAuthenticated) router.push(RENTALS_PATH);
    else setPromptProduct(product);
  };

  if (!loading && !error && groups.length === 0) return null;

  return (
    <section id="do-cho-thue" className="py-16 bg-white border-t border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#174B36] via-[#1E5C43] to-[#2F6B4F] px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-[#B9E769]/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#D9F2C4]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B9E769]" />
                Thuê đồ trekking
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[44px]">
                Thiếu đồ? <span className="text-[#B9E769]">Cứ thuê</span>, khỏi phải mua.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/75 sm:text-base">
                Lều, balo, túi ngủ, giày leo núi… thuê theo đúng ngày của chuyến đi, nhận tại điểm hẹn và được
                kiểm tra lại sau mỗi lần trả. Chọn bản Như mới hoặc Sử dụng tốt tuỳ ngân sách.
              </p>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-3 text-center">
              {[
                { value: loading ? "…" : String(groups.length), label: "Mẫu thiết bị" },
                { value: "2", label: "Tình trạng" },
                { value: loading ? "…" : String(categoryChips.length), label: "Danh mục" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
                  <p className="text-2xl font-black text-white">{stat.value}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-white/65">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {categoryChips.length > 1 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {[{ id: "all", name: "Tất cả", count: groups.length }, ...categoryChips].map((chip) => {
              const active = chip.id === activeCategory;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(chip.id);
                    setVisible(INITIAL_VISIBLE);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition ${active ? "border-[#174B36] bg-[#174B36] text-white shadow-[0_6px_16px_rgba(23,75,54,0.25)]" : "border-[#DDE8DF] bg-white text-[#17251D] hover:border-emerald-500/50 hover:bg-emerald-50/60"}`}
                >
                  {chip.name}
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-black ${active ? "bg-white/20 text-white" : "bg-[#EEF3EF] text-gray-500"}`}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[420px] animate-pulse rounded-[22px] bg-[#EEF3EF]" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
            {error}
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.slice(0, visible).map((group) => (
                <ShowcaseCard
                  key={group.key}
                  group={group}
                  selectedId={selectedVariants[group.key]}
                  onSelectVariant={(id) =>
                    setSelectedVariants((current) => ({ ...current, [group.key]: id }))
                  }
                  onOpen={openProduct}
                />
              ))}
            </div>
            {visible < filtered.length && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((current) => current + INITIAL_VISIBLE)}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#174B36]/20 px-6 text-sm font-black text-[#174B36] transition hover:bg-emerald-50"
                >
                  Xem thêm ({filtered.length - visible} sản phẩm)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {promptProduct && (
        <LoginPromptDialog product={promptProduct} onClose={() => setPromptProduct(null)} />
      )}
    </section>
  );
}
