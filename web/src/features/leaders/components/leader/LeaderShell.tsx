"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuthStore } from "@/features/auth";

type NavItem = {
  label: string;
  href: string;
  icon: string;
  badge?: string;
};

const leaderItems: NavItem[] = [
  { label: "Dashboard", href: "/leader", icon: "▦" },
  {
    label: "Chuyến đi của tôi",
    href: "/leader/trips",
    icon: "♙",
    badge: "5",
  },
  {
    label: "Tạo chuyến đi mới",
    href: "/leader/create-trip",
    icon: "⊕",
  },
];

const trekkerItems: NavItem[] = [
  {
    label: "Khám phá cung đường",
    href: "/trips",
    icon: "◉",
  },
  {
    label: "Chuyến đi đã đặt",
    href: "/my-trips",
    icon: "⌑",
  },
  {
    label: "Thuê thiết bị",
    href: "/rentals?bookingId=booking_001",
    icon: "♧",
  },
];

const accountItems: NavItem[] = [
  {
    label: "Hồ sơ cá nhân",
    href: "/leader/profile",
    icon: "♙",
  },
  {
    label: "Cài đặt an toàn VFRS",
    href: "/leader/safety",
    icon: "♢",
  },
];

function NavGroup({
  title,
  items,
}: {
  title: string;
  items: NavItem[];
}) {
  const pathname = usePathname();

  return (
    <section className="space-y-1">
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </p>

      {items.map((item) => {
        const active =
          item.href === "/leader"
            ? pathname === item.href
            : pathname.startsWith(item.href.split("?")[0]);

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition ${
              active
                ? "bg-[#236747] font-semibold text-white shadow-sm"
                : "text-slate-700 hover:bg-[#e7eefb] hover:text-[#125238]"
            }`}
          >
            <span className="w-5 text-center text-base">
              {item.icon}
            </span>

            <span className="flex-1">{item.label}</span>

            {item.badge && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </section>
  );
}

export function LeaderShell({
  children,
}: {
  children: ReactNode;
}) {
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    window.location.href = "/public/login";
  };

  return (
    <div className="min-h-screen bg-[#f3f6fc] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-[#f5f7fd] lg:flex lg:flex-col">
        <Link
          href="/leader"
          className="flex h-[72px] items-center gap-3 px-5"
        >
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#236747] text-xl text-white">
            ⛰
          </span>

          <span>
            <strong className="block text-[15px] leading-none text-[#123f2d]">
              Trekking System
            </strong>

            <small className="mt-1 block text-[10px] font-bold tracking-wide text-amber-800">
              LEADER PORTAL
            </small>
          </span>
        </Link>

        <nav className="space-y-6 overflow-y-auto px-3 py-4">
          <NavGroup
            title="Quản lý dẫn đoàn"
            items={leaderItems}
          />

          <NavGroup
            title="Tính năng Trekker"
            items={trekkerItems}
          />

          <NavGroup
            title="Tài khoản & hệ thống"
            items={accountItems}
          />
        </nav>

        <div className="mt-auto space-y-3 border-t border-slate-200 p-3">
          <a
            href="tel:18009988"
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-bold text-white hover:bg-red-700"
          >
            ✣ SOS Hotline 1800-9988
          </a>

          <div className="flex items-center gap-3 rounded-xl bg-[#e5edfb] p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#125238] text-xs font-bold text-white">
              NH
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                Nguyễn Hùng
              </p>

              <p className="text-[11px] text-amber-800">
                Leader PRO
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-900">
              ◎ Hệ thống radar cảnh báo thời tiết núi hoạt
              động tốt
            </span>

            <span className="rounded-lg bg-[#edf2fc] px-3 py-2">
              ☼ Fansipan: <b>14°C</b>
            </span>

            <span className="rounded-lg bg-[#edf2fc] px-3 py-2">
              ☁ Tà Xùa: <b>16°C</b>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href="tel:18009988"
              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
            >
              SOS 1800-9988
            </a>

            <span className="rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-bold text-white">
              LEADER PRO
            </span>

            <button
              type="button"
              aria-label="Thông báo"
              className="relative grid h-9 w-9 place-items-center rounded-lg bg-[#edf2fc]"
            >
              ♟

              <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[9px] text-white">
                3
              </span>
            </button>

            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#125238] text-white">
              ♙
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}