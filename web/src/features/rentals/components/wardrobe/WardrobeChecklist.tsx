"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GearCategory, GearCondition, UserGearItem } from "@/features/rentals/services/gear.api";
import { gearAttributes } from "@/features/rentals/services/gear-attribute-schema";
import { downloadPackingChecklist } from "../gear-checklist-template";

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
