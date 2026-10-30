"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAuthStore } from "@/features/auth";

type WorkspaceRole = "user" | "staff" | "delivery" | "admin";

const navigation: Record<WorkspaceRole, Array<[string, string]>> = {
  user: [
    ["/rentals", "Danh mục"],
    ["/rentals/orders", "Đơn thuê"],
    ["/rentals/wardrobe", "Tủ đồ"],
    ["/rentals/reviews", "Đánh giá"],
    ["/rentals/transactions", "Lịch sử giao dịch"],
  ],
  staff: [
    ["/staff/work-queue", "Hàng đợi chuẩn bị"],
    ["/staff/work-queue", "Soạn & kiểm tra"],
    ["/staff/work-queue", "Đóng gói & custody"],
    ["/staff/inventory", "Kho & thiết bị"],
    ["/staff/returns", "Kiểm định hoàn trả"],
    ["/staff/rentals", "Danh mục cho thuê"],
    ["/staff/returns", "Theo dõi xử lý cọc"],
  ],
  delivery: [
    ["/delivery/tasks", "Nhiệm vụ hôm nay"],
    ["/delivery", "Bàn giao hiện trường"],
  ],
  admin: [
    ["/admin", "Tổng quan"],
    ["/admin/rental-returns", "Ngoại lệ & hoàn cọc"],
  ],
};

const notes: Record<WorkspaceRole, string> = {
  user: "Danh mục thiết bị, đơn thuê, tủ đồ, đánh giá và lịch sử giao dịch của bạn.",
  staff: "Đơn đã thanh toán mới sinh task kho. Kiểm định đạt đi thẳng tới hoàn cọc.",
  delivery: "Mỗi lần bàn giao chuyển custody — quét QR kiện trước khi giao hoặc nhận.",
  admin: "Chỉ hư hỏng, thất lạc, sai lệch custody hoặc hoàn cọc lỗi mới cần Admin.",
};

const roleNames: Record<WorkspaceRole, string> = {
  user: "Khách thuê",
  staff: "Staff kho",
  delivery: "Giao nhận",
  admin: "Admin",
};

function linkIsActive(pathname: string, role: WorkspaceRole, index: number, href: string) {
  if (role === "user") {
    if (index === 0) return pathname === "/rentals" || pathname.startsWith("/rental-products/") || pathname === "/rentals/quote";
    if (index === 1) return pathname === "/rentals/orders" || pathname.startsWith("/rentals/orders/");
  }
  if (role === "staff") {
    if (index === 2) return pathname.includes("/packing");
    if (index === 1) return pathname.startsWith("/staff/orders/") && !pathname.includes("/packing");
  }
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function RentalWorkspaceShell({ role, children }: { role: WorkspaceRole; children: ReactNode }) {
  const pathname = usePathname();
  const darkSurface =
    (role === "staff" && pathname.includes("/packing")) ||
    (role === "admin" && pathname.startsWith("/admin/rental-returns"));
  const user = useAuthStore((state) => state.user);
  const displayName = user?.fullName || user?.name || user?.email?.split("@")[0] || roleNames[role];
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TG";

  return (
    <div className={`min-h-screen ${darkSurface ? "bg-[#07110c] text-[#eef4ef]" : "bg-[#ecf0eb] text-[#0f1f17]"}`}>
      <header className="sticky top-0 z-[120] border-b border-white/5 bg-[#071b13] text-[#eef4ef]">
        <div className="mx-auto flex min-h-[68px] max-w-[1440px] flex-wrap items-center gap-4 px-5 lg:px-7">
          <Link href="/rentals" className="flex shrink-0 items-center gap-3" aria-label="Vina TrekGo Rental">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-white ring-2 ring-orange-400/40">
              <Image src="/brand/vina-trekgo-badge.png" alt="" width={44} height={44} priority />
            </span>
            <span>
              <b className="block text-[20px] font-black leading-none tracking-[-0.03em]">Vina TrekGo</b>
              <small className="mt-1 block text-[10px] font-bold tracking-[0.18em] text-emerald-100/65">RENTAL · BASECAMP</small>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black text-white ${role === "admin" ? "bg-violet-700" : role === "delivery" ? "bg-blue-700" : "bg-[#2c6e3e]"}`}>{initials}</span>
            <p className="hidden text-sm font-bold leading-tight sm:block">
              {displayName}
              <span className="block text-[11px] font-medium text-emerald-100/65">{role === "user" ? "Thành viên Vina_TrekGo" : role === "staff" ? "Thủ kho · đang hoạt động" : role === "admin" ? "Admin vận hành" : "Giao nhận · trực tuyến"}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-7 px-5 pb-20 pt-7 lg:grid-cols-[232px_minmax(0,1fr)] lg:px-7">
        <aside className="self-start lg:sticky lg:top-[94px]">
          <p className={`px-3 pb-2 text-[11px] font-black uppercase tracking-[0.16em] ${darkSurface ? "text-emerald-100/60" : "text-[#596a60]"}`}>{roleNames[role]}</p>
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1" aria-label="Luồng thuê thiết bị">
            {navigation[role].map(([href, label], index) => {
              const active = linkIsActive(pathname, role, index, href);
              return (
                <Link key={`${index}-${label}`} href={href} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? darkSurface ? "bg-[#12291d] text-white shadow-[inset_3px_0_0_#f58b36]" : "bg-white text-[#102119] shadow-[inset_3px_0_0_#f58b36]" : darkSurface ? "text-emerald-50/60 hover:bg-white/5 hover:text-white" : "text-[#58685f] hover:bg-white/70 hover:text-[#102119]"}`}>
                  <i className="w-5 font-mono text-[11px] not-italic opacity-70">{String(index + 1).padStart(2, "0")}</i>
                  {label}
                </Link>
              );
            })}
          </nav>
          <p className={`mt-4 hidden rounded-2xl border border-dashed p-4 text-xs leading-5 lg:block ${darkSurface ? "border-emerald-800 text-emerald-100/60" : "border-[#cbd6cc] text-[#58685f]"}`}>{notes[role]}</p>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
