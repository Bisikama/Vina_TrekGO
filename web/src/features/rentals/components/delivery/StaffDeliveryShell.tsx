"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type StaffDeliveryShellProps = {
  children: ReactNode;
};

const navigation = [
  {
    href: "/delivery/tasks",
    label: "Nhiệm vụ hôm nay",
    description: "Giao và thu hồi thiết bị",
  },
] as const;

function TruckIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h11v10H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

function MenuIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function BellIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function WifiIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5a10 10 0 0 1 14 0" />
      <path d="M8.5 16a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
    </svg>
  );
}

export function StaffDeliveryShell({
  children,
}: StaffDeliveryShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f4f7fd] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <Link
            href="/delivery/tasks"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d5b3a] text-white">
              <TruckIcon className="h-6 w-6" />
            </div>

            <div>
              <p className="font-black leading-none text-[#123f2d]">
                TrekOps
              </p>

              <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">
                Giao nhận thực địa
              </p>
            </div>
          </Link>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-xl bg-[#eaf5ee] px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#39735a]">
              Vai trò đăng nhập
            </p>

            <p className="mt-1 text-sm font-black text-[#0d5b3a]">
              Nhân viên giao nhận
            </p>

            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Đang trực tuyến
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                  active
                    ? "bg-[#0d5b3a] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#0d5b3a]"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    active
                      ? "bg-white/15"
                      : "bg-slate-100"
                  }`}
                >
                  <TruckIcon />
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-extrabold">
                    {item.label}
                  </p>

                  <p
                    className={`mt-0.5 truncate text-[10px] ${
                      active
                        ? "text-emerald-100"
                        : "text-slate-400"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dcece2] font-black text-[#0d5b3a]">
              HT
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-slate-900">
                Hoàng Văn Tuấn
              </p>

              <p className="truncate text-xs text-slate-500">
                Staff Delivery · Sa Pa
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-[68px] items-center justify-between px-5 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 lg:hidden"
                aria-label="Mở menu giao nhận"
              >
                <MenuIcon />
              </button>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Vina TrekGo
                </p>

                <p className="mt-0.5 font-extrabold text-slate-900">
                  Trung tâm giao nhận thực địa
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-800 sm:inline-flex">
                <WifiIcon />
                GPS ON
              </span>

              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Thông báo"
              >
                <BellIcon />

                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              </button>

              <span className="hidden rounded-full bg-[#0d5b3a] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white md:inline-flex">
                Staff Delivery
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 px-4 py-2 lg:hidden">
            <Link
              href="/delivery/tasks"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                pathname.startsWith("/delivery/tasks")
                  ? "bg-[#0d5b3a] text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <TruckIcon />
              Nhiệm vụ hôm nay
            </Link>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}