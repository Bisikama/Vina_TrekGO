"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  {
    href: "/delivery",
    label: "Quản lý Giao hàng",
    icon: "delivery",
  },
  {
    href: "/delivery/schedule",
    label: "Lịch trình của tôi",
    icon: "calendar",
  },
  {
    href: "/delivery/profile",
    label: "Hồ sơ cá nhân",
    icon: "user",
  },
] as const;

function NavIcon({ type }: { type: string }) {
  const paths: Record<string, string> = {
    delivery:
      "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
    calendar:
      "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
    user:
      "M20 21a8 8 0 0 0-16 0m8-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  };

  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d={paths[type]}
      />
    </svg>
  );
}

export function DeliveryShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f4f7fd] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col border-r border-slate-200 bg-white">
        <div className="flex h-[70px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#b45309] text-white">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>

          <div>
            <p className="text-[17px] font-black leading-none text-[#78350f]">
              TrekDelivery
            </p>

            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Vận chuyển & Giao nhận
            </p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-800">
            Tài xế giao hàng
          </span>
        </div>

        <nav className="mt-3 space-y-1 px-3">
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== '/delivery' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition ${
                  active
                    ? "bg-[#d97706] text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <NavIcon type={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="pl-[236px]">
        <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-[#78350f]">
              Cổng Tài xế Vận chuyển
            </span>

            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
              ĐANG HOẠT ĐỘNG
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-bold">
                Lê Tiến Đạt
              </p>

              <p className="text-[10px] text-slate-500">
                Khu vực: Cầu Giấy, Hà Nội
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#b45309] text-xs font-black text-white">
              LĐ
            </div>
            
            <button
              type="button"
              onClick={() => {
                document.cookie = "mock_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                window.location.href = "/public/login";
              }}
              className="ml-2 cursor-pointer rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
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
