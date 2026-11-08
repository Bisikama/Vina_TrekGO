import Link from "next/link";
import type { ReactNode } from "react";

import { TrekBanner } from "./trek/TrekBanner";

const links = [
  ["/rentals", "Danh mục"],
  ["/rentals/orders", "Đơn thuê"],
  ["/rentals/wardrobe", "Tủ đồ"],
  ["/rentals/gear-advisor", "Kế hoạch đồ"],
  ["/rentals/reviews", "Đánh giá"],
  ["/rentals/transactions", "Lịch sử giao dịch"],
] as const;

export function RentalSectionNav({ active }: { active: string }) {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Khu vực thuê thiết bị">
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            active === href ? "bg-[#153E2E] text-white" : "border border-emerald-900/10 bg-white text-gray-700 hover:bg-emerald-50"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function RentalPageHeader({
  eyebrow,
  title,
  highlight,
  description,
  active,
  action,
  aside,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  description: string;
  active: string;
  action?: { href: string; label: string };
  aside?: ReactNode;
}) {
  return (
    <>
      <TrekBanner eyebrow={eyebrow} title={title} highlight={highlight} description={description} action={action} aside={aside} />
      <div className="mt-5"><RentalSectionNav active={active} /></div>
    </>
  );
}

export const shortCode = (value: string) => value.replaceAll("-", "").slice(-6).toUpperCase();
export const money = (value: number | string, currency = "VND") => new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
export const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Chưa cập nhật";
