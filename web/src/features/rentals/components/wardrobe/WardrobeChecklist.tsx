"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GearCategory, GearCondition, UserGearItem } from "@/features/rentals/services/gear.api";
import { gearAttributes } from "@/features/rentals/services/gear-attribute-schema";
import { downloadPackingChecklist } from "../gear-checklist-template";
import { CompletenessBar, GearThumb, gearSourceInfo, specCompleteness } from "./GearVisuals";
import { Reveal, TopoOverlay } from "../trek/TrekKit";

// Tủ đồ dạng danh sách đồ mang theo: đồ chia nhóm theo loại, mỗi món có ô tích "đã soạn vào balo".
// Dấu tích chỉ lưu trên trình duyệt này (backend chưa có API lưu trạng thái soạn đồ).

export const CATEGORY_ORDER: Array<[GearCategory, string]> = [
  ["BACKPACK", "Balo"],
  ["TENT", "Lều"],
  ["SLEEPING_BAG", "Túi ngủ"],
  ["JACKET", "Áo khoác"],
  ["RAIN_GEAR", "Đồ đi mưa"],
  ["PANTS", "Quần"],
  ["FOOTWEAR", "Giày"],
  ["TREKKING_POLE", "Gậy trekking"],
];

const CONDITION_TEXT: Record<GearCondition, string> = { new: "Mới", good: "Tốt", worn: "Đã dùng", poor: "Cũ/kém" };

function formatValue(value: unknown, unit: string) {
  if (value === true) return "Có";
  if (value === false) return "Không";
  if (unit === "coverage") return value === "FULL_BODY" ? "Toàn thân" : "Thân trên";
  if (unit === "/5") return `Độ bám ${String(value)}/5`;
  return unit ? `${String(value)} ${unit}` : String(value);
}

/** Tóm tắt 2–3 thông số đã biết, ví dụ "45 L · 1400 g · Áo trùm mưa". */
export function specSummary(item: Pick<UserGearItem, "category" | "attributes">, limit = 3) {
  return gearAttributes(item.category)
    .filter(([key]) => item.attributes?.[key] !== null && item.attributes?.[key] !== undefined && item.attributes?.[key] !== false)
    .slice(0, limit)
    .map(([key, label, unit]) => (unit === "bool" ? label : formatValue(item.attributes[key], unit)))
    .join(" · ");
}

/** Trạng thái "đã soạn" lưu theo người dùng trên trình duyệt hiện tại. */
export function usePackedItems(userKey: string, itemIds: string[]) {
  const storageKey = `trekgo:wardrobe-packed:${userKey}`;
  const [packed, setPacked] = useState<Set<string>>(new Set());
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[];
    } catch {
      stored = [];
    }
    loadedKey.current = storageKey;
    const timer = window.setTimeout(() => setPacked(new Set(Array.isArray(stored) ? stored : [])), 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const persist = useCallback(
    (next: Set<string>) => {
      try {
        // Chỉ giữ id món còn trong tủ để bộ nhớ không phình theo món đã gỡ.
        const alive = itemIds.length ? [...next].filter((id) => itemIds.includes(id)) : [...next];
        localStorage.setItem(storageKey, JSON.stringify(alive));
      } catch {
        // Trình duyệt chặn bộ nhớ: dấu tích chỉ còn trong phiên này.
      }
    },
    [itemIds, storageKey],
  );

  const toggle = useCallback(
    (id: string) => {
      setPacked((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clear = useCallback(() => {
    const next = new Set<string>();
    persist(next);
    setPacked(next);
  }, [persist]);

  return { packed, toggle, clear };
}

export function PackingProgress({
  packedCount,
  total,
  onClear,
  onPrint,
  addMenu,
}: {
  packedCount: number;
  total: number;
  onClear: () => void;
  onPrint: () => void;
  addMenu: React.ReactNode;
}) {
  const percent = total ? Math.round((packedCount / total) * 100) : 0;
  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#E7EBE8] bg-white p-5 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">
          Đã soạn <b className="font-semibold text-[#123F32]">{packedCount}/{total}</b> món
          <span className="text-slate-400"> · tủ chứa tối đa 50 món</span>
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF1EE]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#2F8A63] to-[#165C45] transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={packedCount === 0}
          className="rounded-xl border border-[#DDE3DF] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          Bỏ tích hết
        </button>
        <button
          type="button"
          onClick={onPrint}
          disabled={total === 0}
          className="rounded-xl border border-[#B9D6C6] bg-[#F1F8F4] px-4 py-2.5 text-sm font-medium text-[#123F32] transition hover:bg-[#E4F2EA] disabled:opacity-40"
        >
          ⤓ Tải danh sách (PDF)
        </button>
        {addMenu}
      </div>
    </div>
  );
}

export function AddGearMenu({
  disabled,
  quotaText,
  onImage,
  onLink,
  onCatalog,
  onManual,
}: {
  disabled: boolean;
  quotaText: string | null;
  onImage: () => void;
  onLink: () => void;
  onCatalog: () => void;
  onManual: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };
  const items: Array<{ label: string; hint: string; action: () => void; ai?: boolean }> = [
    { label: "Chụp hoặc chọn ảnh", hint: "AI đọc tem, nhãn sản phẩm", action: onImage, ai: true },
    { label: "Dán đường dẫn", hint: "AI đọc trang sản phẩm", action: onLink, ai: true },
    { label: "Chọn từ danh mục", hint: "Món đã được TrekGo duyệt", action: onCatalog },
    { label: "Tự nhập", hint: "Điền tên và thông số", action: onManual },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-xl bg-[#165C45] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#124B39]"
      >
        + Thêm đồ
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={disabled && item.ai}
              onClick={() => choose(item.action)}
              className="flex w-full flex-col items-start rounded-xl px-3 py-2.5 text-left transition hover:bg-emerald-50/70 disabled:cursor-wait disabled:opacity-50"
            >
              <span className="text-sm font-medium text-slate-900">{item.label}</span>
              <span className="text-xs text-slate-500">{item.hint}</span>
            </button>
          ))}
          {quotaText ? <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">{quotaText}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ChecklistGroup({
  label,
  items,
  packed,
  onToggle,
  onEdit,
}: {
  label: string;
  items: UserGearItem[];
  packed: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (item: UserGearItem) => void;
}) {
  const done = items.filter((item) => packed.has(item.id)).length;
  const complete = done === items.length;
  return (
    <section className="mb-4 break-inside-avoid rounded-2xl border border-[#E7EBE8] bg-white px-5 py-4">
      <header className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[#123F32]">{label}</h3>
        <span className={`text-xs font-medium ${complete ? "text-[#1F6B4A]" : "text-slate-500"}`}>
          {complete ? "✓ " : ""}
          {done}/{items.length}
        </span>
      </header>
      <ul className="mt-1">
        {items.map((item) => {
          const checked = packed.has(item.id);
          const specs = specSummary(item);
          return (
            <li key={item.id} className="group flex items-center gap-3.5 border-t border-[#EEF1EE] py-3 first:border-t-0">
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`${checked ? "Bỏ tích" : "Tích"} ${item.name}`}
                onClick={() => onToggle(item.id)}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] text-[13px] text-white transition ${
                  checked ? "border-[#1F6B4A] bg-[#1F6B4A]" : "border-[#B9C2BC] bg-white hover:border-[#1F6B4A]"
                }`}
              >
                {checked ? "✓" : ""}
              </button>
              <button type="button" onClick={() => onToggle(item.id)} className="min-w-0 flex-1 text-left">
                <span className={`block truncate text-sm font-medium transition ${checked ? "text-slate-400 line-through" : "text-slate-900"}`}>
                  {item.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {item.brand || "Chưa rõ hãng"} · {CONDITION_TEXT[item.condition] ?? item.condition}
                  {specs ? <span className="text-slate-600"> · {specs}</span> : null}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Sửa
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const ADD_ICONS = {
  image: <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  catalog: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2 2 4-4" />,
  manual: <path d="M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4" />,
};

export type SmartAddStatus = { ready: boolean; note?: string | null };

/** Các cách thêm đồ, hiện như tính năng nổi bật thay vì giấu trong menu. */
export function SmartAddPanel({
  disabled,
  quotaText,
  image,
  link,
  onImage,
  onLink,
  onCatalog,
  onManual,
}: {
  disabled: boolean;
  quotaText: string | null;
  image: SmartAddStatus;
  link: SmartAddStatus;
  onImage: () => void;
  onLink: () => void;
  onCatalog: () => void;
  onManual: () => void;
}) {
  const tiles: Array<{ key: keyof typeof ADD_ICONS; title: string; text: string; tag: string; tone: string; action: () => void; status?: SmartAddStatus; ai?: boolean }> = [
    { key: "image", title: "Chụp tem / nhãn", text: "AI đọc loại đồ, hãng và thông số từ ảnh tem mác.", tag: "AI", tone: "from-violet-500 to-fuchsia-500", action: onImage, status: image, ai: true },
    { key: "link", title: "Dán link sản phẩm", text: "AI đọc bảng thông số trên trang bán hàng.", tag: "AI", tone: "from-sky-500 to-cyan-500", action: onLink, status: link, ai: true },
    { key: "catalog", title: "Danh mục đã duyệt", text: "Chọn mẫu có thông số được TrekGo kiểm chứng nguồn.", tag: "Tin cậy", tone: "from-emerald-500 to-teal-500", action: onCatalog },
    { key: "manual", title: "Tự nhập", text: "Điền tên, ảnh và thông số bạn biết.", tag: "Nhanh", tone: "from-slate-500 to-slate-600", action: onManual },
  ];
  return (
    <section className="relative mt-6 overflow-hidden rounded-3xl border border-[#E7EBE8] bg-white p-5">
      <TopoOverlay dark className="opacity-[0.05]" />
      <div className="relative flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#123F32]">Thêm đồ vào tủ</h2>
          <p className="text-xs text-slate-500">Thông số càng đủ, Kế hoạch đồ đánh giá càng chính xác. Mọi kết quả AI đều là bản nháp để bạn kiểm tra trước khi lưu.</p>
        </div>
        {quotaText ? <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">{quotaText}</span> : null}
      </div>
      <div className="relative mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile, index) => (
          <Reveal key={tile.key} delay={index * 90}>
          <button
            type="button"
            disabled={disabled && tile.ai}
            onClick={tile.action}
            className="trek-lift group relative flex h-full w-full items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-300 disabled:cursor-wait disabled:opacity-50"
          >
            {tile.ai ? <span aria-hidden="true" className="trek-shimmer pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100" /> : null}
            <span className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm transition duration-300 group-hover:-rotate-6 group-hover:scale-110 ${tile.tone}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">{ADD_ICONS[tile.key]}</svg>
            </span>
            <span className="relative min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{tile.title}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{tile.tag}</span>
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{tile.text}</span>
              {tile.status && !tile.status.ready ? (
                <span className="mt-1 block text-[11px] font-medium text-amber-700">{tile.status.note ?? "Đang tắt — bạn vẫn nhận bản nháp để nhập tay."}</span>
              ) : null}
            </span>
          </button>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** Tổng quan tủ đồ: số món, có ảnh, đủ thông số, tiến độ soạn đồ. */
export function WardrobeOverview({
  items,
  packedCount,
  onClear,
  onPrint,
  onShowIncomplete,
}: {
  items: UserGearItem[];
  packedCount: number;
  onClear: () => void;
  onPrint: () => void;
  onShowIncomplete: () => void;
}) {
  const withPhoto = items.filter((item) => item.photoUrl || item.photoRef).length;
  const complete = items.filter((item) => specCompleteness(item).complete).length;
  const percent = items.length ? Math.round((packedCount / items.length) * 100) : 0;
  const stats: Array<[string, string, string]> = [
    ["Món trong tủ", `${items.length}`, "tối đa 50 món"],
    ["Có ảnh", `${withPhoto}`, `${items.length - withPhoto} món chưa có ảnh`],
    ["Đủ thông số", `${complete}`, `${items.length - complete} món cần bổ sung`],
  ];
  return (
    <div className="mt-6 grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.6fr)]">
      {stats.map(([label, value, hint], index) => (
        <Reveal key={label} delay={index * 80} className="trek-lift rounded-2xl border border-[#E7EBE8] bg-white p-4">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-[#123F32]">{value}</p>
          {index === 2 && items.length - complete > 0 ? (
            <button type="button" onClick={onShowIncomplete} className="mt-0.5 text-xs font-medium text-amber-700 underline-offset-2 hover:underline">{hint} ›</button>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
          )}
        </Reveal>
      ))}
      <Reveal delay={240} className="flex items-center gap-4 rounded-2xl border border-[#E7EBE8] bg-white p-4">
        <BackpackFill percent={percent} />
        <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Đã soạn vào balo</p>
          <p className="text-sm font-semibold text-[#123F32]">{packedCount}/{items.length}</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF1EE]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#2F8A63] to-[#165C45] transition-all duration-700" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onPrint} disabled={!items.length} className="rounded-xl border border-[#B9D6C6] bg-[#F1F8F4] px-3 py-2 text-xs font-medium text-[#123F32] transition hover:bg-[#E4F2EA] disabled:opacity-40">⤓ Tải danh sách (PDF)</button>
          <button type="button" onClick={onClear} disabled={packedCount === 0} className="rounded-xl border border-[#DDE3DF] px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Bỏ tích hết</button>
        </div>
        </div>
      </Reveal>
    </div>
  );
}

const BACKPACK_BODY = "M10 18a8 8 0 0 1 8-8h12a8 8 0 0 1 8 8v36a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4z";

/** Balo đầy dần theo tiến độ soạn đồ. */
function BackpackFill({ percent }: { percent: number }) {
  const top = 10;
  const height = 48;
  const fill = (height * Math.max(0, Math.min(100, percent))) / 100;
  return (
    <svg viewBox="0 0 48 60" className={`h-16 w-14 shrink-0 ${percent === 100 ? "trek-float" : ""}`} aria-hidden="true">
      <defs>
        <clipPath id="trek-backpack-body"><path d={BACKPACK_BODY} /></clipPath>
        <linearGradient id="trek-backpack-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" /><stop offset="100%" stopColor="#165C45" /></linearGradient>
      </defs>
      <path d="M18 10V7a6 6 0 0 1 12 0v3" fill="none" stroke="#165C45" strokeWidth={2.5} />
      <path d={BACKPACK_BODY} fill="#EDF1EE" />
      <g clipPath="url(#trek-backpack-body)">
        <rect x={8} y={top + height - fill} width={32} height={fill} fill="url(#trek-backpack-grad)" style={{ transition: "y .8s cubic-bezier(.2,.7,.2,1), height .8s cubic-bezier(.2,.7,.2,1)" }} />
      </g>
      <path d={BACKPACK_BODY} fill="none" stroke="#165C45" strokeWidth={2.5} />
      <path d="M16 36h16v10H16z" fill="none" stroke="#165C45" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

const CONDITION_TONE: Record<GearCondition, string> = {
  new: "bg-emerald-50 text-emerald-700",
  good: "bg-teal-50 text-teal-700",
  worn: "bg-amber-50 text-amber-700",
  poor: "bg-rose-50 text-rose-700",
};

/** Nhóm đồ dạng thẻ có ảnh: nguồn dữ liệu, thông số chính, độ đầy đủ thông số và dấu "đã soạn". */
export function GearCardGroup({
  category,
  label,
  items,
  packed,
  onToggle,
  onEdit,
}: {
  category: GearCategory;
  label: string;
  items: UserGearItem[];
  packed: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (item: UserGearItem) => void;
}) {
  const done = items.filter((item) => packed.has(item.id)).length;
  return (
    <section className="mt-6">
      <header className="mb-3 flex items-center gap-3">
        <GearThumb category={category} name={label} size="xs" />
        <h3 className="text-base font-semibold text-[#123F32]">{label}</h3>
        <span className="text-xs text-slate-500">{items.length} món · đã soạn {done}</span>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {items.map((item, index) => {
          const checked = packed.has(item.id);
          const source = gearSourceInfo(item);
          const completeness = specCompleteness(item);
          const chips = gearAttributes(item.category)
            .filter(([key]) => item.attributes?.[key] !== null && item.attributes?.[key] !== undefined && item.attributes?.[key] !== false)
            .slice(0, 3)
            .map(([key, attrLabel, unit]) => (unit === "bool" ? attrLabel : formatValue(item.attributes[key], unit)));
          return (
            <Reveal
              as="li"
              key={item.id}
              delay={index * 60}
              className={`trek-lift group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_6px_20px_rgba(18,63,50,.05)] ${checked ? "border-[#9BC9AF]" : "border-[#E7EBE8]"}`}
            >
              <button type="button" onClick={() => onEdit(item)} className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-50 text-left" aria-label={`Xem ${item.name}`}>
                <GearThumb url={item.photoUrl} category={item.category} name={item.name} size="fill" className="transition duration-300 group-hover:scale-[1.03]" />
                <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${source.className}`}>{source.label}</span>
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition group-hover:opacity-100" />
                {checked ? <span className="trek-pop absolute bottom-3 right-3 rounded-full bg-[#1F6B4A] px-2.5 py-1 text-[11px] font-semibold text-white shadow">Trong balo ✓</span> : null}
              </button>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`${checked ? "Bỏ tích" : "Tích"} đã soạn ${item.name}`}
                onClick={() => onToggle(item.id)}
                className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm transition ${checked ? "bg-[#1F6B4A] text-white" : "bg-white/90 text-slate-700 hover:bg-white"}`}
              >
                <span className={`grid h-3.5 w-3.5 place-items-center rounded-full border text-[9px] ${checked ? "border-white" : "border-slate-400"}`}>{checked ? "✓" : ""}</span>
                {checked ? "Đã soạn" : "Soạn"}
              </button>
              <div className="flex flex-1 flex-col p-4">
                <p className={`line-clamp-2 text-sm font-semibold leading-5 ${checked ? "text-slate-500" : "text-slate-900"}`}>{item.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <span>{item.brand || "Chưa rõ hãng"}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${CONDITION_TONE[item.condition] ?? "bg-slate-100 text-slate-600"}`}>{CONDITION_TEXT[item.condition] ?? item.condition}</span>
                </div>
                {chips.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chips.map((chip) => <span key={chip} className="rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-100">{chip}</span>)}
                  </div>
                ) : null}
                <div className="mt-auto pt-3">
                  <p className="mb-1 text-[11px] text-slate-500">{completeness.complete ? "Đủ thông số để đánh giá" : "Thông số đã có"}</p>
                  <CompletenessBar known={completeness.known} total={completeness.total} />
                </div>
              </div>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}

/** Tải PDF tủ đồ theo nhóm, giữ các dấu tích trên trình duyệt tại thời điểm xuất. */
export async function printPackingList(items: UserGearItem[], packed: Set<string>) {
  const today = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date());
  const checklist = CATEGORY_ORDER.flatMap(([category, label]) => items.filter((item) => item.category === category).map((item) => ({
    requirementId: item.id, category, title: item.name, priority: "WARDROBE", quantity: 1,
    remainingQuantity: 0, status: "", assignedItemIds: [], exportSection: label,
    exportDetail: [item.brand, specSummary(item)].filter(Boolean).join(" · "),
  })));
  await downloadPackingChecklist("", today, 0, checklist, checklist.map((item) => ({ requirementId: item.requirementId, isChecked: packed.has(item.requirementId) })), {}, { kind: "wardrobe" });
}
