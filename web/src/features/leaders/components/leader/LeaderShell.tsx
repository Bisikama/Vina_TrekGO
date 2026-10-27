"use client";

import Image from "next/image";
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
  },
  {
    label: "Tạo chuyến đi mới",
    href: "/leader/create-trip",
    icon: "⊕",
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
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6B7280]">
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
                ? "bg-[#2F6B4F] font-semibold text-white shadow-sm"
                : "text-[#1F2937] hover:bg-[#EFEFE9] hover:text-[#125238]"
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
  const user = useAuthStore((state) => state.user);

  const displayName = user?.fullName || user?.email?.split("@")[0] || "Leader";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "LD";
  const userRole = user?.role === "LEADER" ? "Leader PRO" : user?.role || "Leader";

  const handleLogout = () => {
    logout();
    window.location.href = "/public/login";
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] text-[#1F2937]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#E5E7EB] bg-white lg:flex lg:flex-col">
        <Link
          href="/leader"
          className="flex h-[72px] items-center gap-3 border-b border-[#E5E7EB] px-5"
        >
          <Image
            src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
            alt="VinaTrekGO"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl object-cover shadow-xs"
          />

          <div className="flex flex-col">
            <strong className="text-lg font-extrabold tracking-tight leading-none text-[#125238]">
              VinaTrek<span className="text-[#F59E0B]">GO</span>
            </strong>

            <small className="mt-1 block text-[10px] font-bold tracking-widest uppercase text-amber-800">
              LEADER PORTAL
            </small>
          </div>
        </Link>

        <nav className="space-y-6 overflow-y-auto px-3 py-5">
          <NavGroup
            title="Quản lý dẫn đoàn"
            items={leaderItems}
          />

          <NavGroup
            title="Tài khoản & hệ thống"
            items={accountItems}
          />
        </nav>

        <div className="mt-auto border-t border-[#E5E7EB] p-3">
          <div className="flex items-center gap-3 rounded-xl bg-[#F7F7F4] border border-[#E5E7EB] p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#125238] text-xs font-bold text-white">
              {initials}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#1F2937]">
                {displayName}
              </p>

              <p className="text-[11px] font-medium text-amber-800">
                {userRole}
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
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 font-medium text-[#125238]">
              ◎ Hệ thống radar cảnh báo thời tiết núi hoạt động tốt
            </span>

            <span className="rounded-lg bg-[#F7F7F4] border border-[#E5E7EB] px-3 py-1.5 tabular-nums">
              ☼ Fansipan: <b>14°C</b>
            </span>

            <span className="rounded-lg bg-[#F7F7F4] border border-[#E5E7EB] px-3 py-1.5 tabular-nums">
              ☁ Tà Xùa: <b>16°C</b>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white">
              {userRole}
            </span>

            <button
              type="button"
              aria-label="Thông báo"
              className="relative grid h-9 w-9 place-items-center rounded-lg bg-[#F7F7F4] border border-[#E5E7EB] text-[#1F2937] hover:bg-[#EFEFE9] transition"
            >
              ♟
            </button>

            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#125238] text-xs font-bold text-white">
              {initials}
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
