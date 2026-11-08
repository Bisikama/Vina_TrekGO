/* eslint-disable @next/next/no-img-element */
"use client";

import type { ReactNode } from "react";

import type { GearCategory, UserGearItem } from "@/features/rentals/services/gear.api";
import { gearAttributes } from "@/features/rentals/services/gear-attribute-schema";

// Thành phần hình ảnh dùng chung cho Tủ đồ và Kế hoạch đồ: icon loại đồ, ảnh thu nhỏ, nguồn dữ liệu, độ đầy đủ thông số.

const ICONS: Record<GearCategory, ReactNode> = {
  JACKET: <path d="M9 3 4 6l2 5 2-1v11h8V10l2 1 2-5-5-3-1.5 2h-3z M12 5v16" />,
  PANTS: <path d="M7 3h10l1.5 18h-4L12 10l-2.5 11h-4z M7 6h10" />,
  FOOTWEAR: <path d="M5 4h5v7l6.5 2.6A3 3 0 0 1 19 16.4V19H4V4z M4 16h15 M10 8h2" />,
  BACKPACK: <path d="M9 6V5a3 3 0 0 1 6 0v1 M6 9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v12H6z M9 13h6v4H9z" />,
  SLEEPING_BAG: <path d="M8 3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z M5 9h14 M9 6h6" />,
  TENT: <path d="M3 20 12 4l9 16z M12 4v16 M9 20l3-6 3 6" />,
  TREKKING_POLE: <path d="M8 3l7 18 M6 3h5 M13.5 17l3-1 M15 21h2" />,
  RAIN_GEAR: <path d="M3 12a9 9 0 0 1 18 0z M12 12v6.5a2 2 0 0 1-4 0 M12 3v0" />,
};

export const CATEGORY_TONE: Record<GearCategory, string> = {
  JACKET: "bg-sky-50 text-sky-700 ring-sky-100",
  PANTS: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  FOOTWEAR: "bg-amber-50 text-amber-700 ring-amber-100",
  BACKPACK: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  SLEEPING_BAG: "bg-violet-50 text-violet-700 ring-violet-100",
  TENT: "bg-lime-50 text-lime-700 ring-lime-100",
  TREKKING_POLE: "bg-orange-50 text-orange-700 ring-orange-100",
  RAIN_GEAR: "bg-cyan-50 text-cyan-700 ring-cyan-100",
};

const SIZES = {
  xs: "h-8 w-8 rounded-lg",
  sm: "h-11 w-11 rounded-xl",
  md: "h-16 w-16 rounded-2xl",
  lg: "h-24 w-24 rounded-2xl",
  fill: "h-full w-full rounded-none",
} as const;

export function CategoryIcon({ category, className = "h-5 w-5" }: { category: GearCategory | string; className?: string }) {
  const icon = ICONS[category as GearCategory] ?? ICONS.BACKPACK;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {icon}
    </svg>
  );
}

/** Ảnh món đồ; chưa có ảnh thì hiện icon của loại đồ trên nền màu. */
export function GearThumb({
  url,
  category,
  name,
  size = "sm",
  className = "",
}: {
  url?: string | null;
  category: GearCategory | string;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const box = `${SIZES[size]} shrink-0 overflow-hidden ${className}`;
  if (url) return <img src={url} alt={name} loading="lazy" className={`${box} bg-slate-100 object-cover`} />;
  const tone = CATEGORY_TONE[category as GearCategory] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  if (size === "fill") {
    return (
      <span className={`${box} relative grid place-items-center ${tone}`} role="img" aria-label={name}>
        <span aria-hidden="true" className="trek-topo-dark absolute inset-0 opacity-[0.12]" />
        <span className="relative flex flex-col items-center gap-2">
          <span className="trek-float grid h-20 w-20 place-items-center rounded-3xl bg-white/80 shadow-sm ring-1 ring-inset ring-white">
            <CategoryIcon category={category} className="h-11 w-11" />
          </span>
          <span className="text-[11px] font-semibold opacity-70">Chưa có ảnh · bấm để thêm</span>
        </span>
      </span>
    );
  }
  const iconSize = size === "xs" ? "h-4 w-4" : size === "sm" ? "h-5 w-5" : size === "md" ? "h-7 w-7" : "h-10 w-10";
  return (
    <span className={`${box} grid place-items-center ring-1 ring-inset ${tone}`} role="img" aria-label={name}>
      <CategoryIcon category={category} className={iconSize} />
    </span>
  );
}

/** Nguồn dữ liệu của món: AI đọc ảnh/link, danh mục đã duyệt hay tự nhập. */
export function gearSourceInfo(item: Pick<UserGearItem, "source" | "attributeProvenance">) {
  const provenance = Object.values(item.attributeProvenance ?? {});
  if (provenance.some((entry) => entry?.source === "VERIFIED_CATALOG")) {
    return { label: "Danh mục đã duyệt", className: "bg-emerald-600 text-white" };
  }
  if (item.source === "ai_image") return { label: "AI đọc ảnh", className: "bg-violet-600 text-white" };
  if (item.source === "ai_link") return { label: "AI đọc link", className: "bg-sky-600 text-white" };
  return { label: "Tự nhập", className: "bg-white/90 text-slate-700 ring-1 ring-slate-200" };
}

/** Số thông số đã biết trên tổng số thông số của loại đồ. */
export function specCompleteness(item: Pick<UserGearItem, "category" | "attributes">) {
  const keys = gearAttributes(item.category).map(([key]) => key);
  const known = keys.filter((key) => item.attributes?.[key] !== null && item.attributes?.[key] !== undefined).length;
  return { known, total: keys.length, complete: keys.length > 0 && known === keys.length };
}

export function CompletenessBar({ known, total }: { known: number; total: number }) {
  const percent = total ? Math.round((known / total) * 100) : 0;
  const tone = percent === 100 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="flex items-center gap-2" title={`${known}/${total} thông số đã có`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[11px] font-medium tabular-nums text-slate-500">{known}/{total}</span>
    </div>
  );
}
