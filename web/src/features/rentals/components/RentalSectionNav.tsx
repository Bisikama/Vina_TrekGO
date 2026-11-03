import Link from "next/link";

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

export function RentalPageHeader({ eyebrow, title, description, active }: { eyebrow: string; title: string; description: string; active: string }) {
  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#123f2f] via-[#185a42] to-[#2b7a59] p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-200/90">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">{description}</p>
      </section>
      <div className="mt-5"><RentalSectionNav active={active} /></div>
    </>
  );
}

export const shortCode = (value: string) => value.replaceAll("-", "").slice(-6).toUpperCase();
export const money = (value: number | string, currency = "VND") => new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0);
export const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Chưa cập nhật";
