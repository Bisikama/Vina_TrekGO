"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useAuthStore } from "@/features/auth";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { getInventoryLocations } from "@/features/rentals/services/staff-inventory.api";
import {
  getUnreadNotificationCount,
  initialsOf,
  STAFF_ROLE_LABELS,
} from "@/features/rentals/services/staff-overview.api";
import type { InventoryLocation } from "@/features/rentals/types/rental";

const navigation = [
  {
    href: "/staff/work-queue",
    label: "Hàng đợi Công việc",
    icon: "queue",
  },
  {
    href: "/staff/rentals",
    label: "Danh mục Cho thuê",
    icon: "catalog",
  },
  {
    href: "/staff/inventory",
    label: "Kho & Thiết bị",
    icon: "warehouse",
  },
  {
    href: "/staff/returns",
    label: "Tiếp nhận Hoàn trả",
    icon: "return",
  },
  {
    href: "/staff/gear-catalog",
    label: "Danh mục đồ cá nhân",
    icon: "badge",
  },
  {
    href: "/staff/schedule",
    label: "Lịch phân ca & Điều phối",
    icon: "calendar",
  },
  {
    href: "/staff/profile",
    label: "Hồ sơ cá nhân",
    icon: "user",
  },
] as const;

function NavIcon({ type }: { type: string }) {
  const paths: Record<string, string> = {
    queue:
      "M5 6h14M5 12h14M5 18h14M3 6h.01M3 12h.01M3 18h.01",
    catalog:
      "M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm4 2h8M8 11h8M8 15h5",
    warehouse:
      "M3 21V9l9-6 9 6v12M7 21v-8h10v8M7 16h10",
    return:
      "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 6 6v3",
    calendar:
      "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z",
    user:
      "M20 21a8 8 0 0 0-16 0m8-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    badge:
      "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3 9 2 2 4-4",
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

export function StaffShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, isLoading: loggingOut } = useLogout();
  const user = useAuthStore((state) => state.user);
  const displayName = user?.fullName || user?.email?.split("@")[0] || "Nhân viên";
  const roleLabel = STAFF_ROLE_LABELS[user?.role ?? ""] ?? "Nhân viên";
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [locations, setLocations] = useState<InventoryLocation[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getUnreadNotificationCount(controller.signal)
      .then((count) => !controller.signal.aborted && setUnreadCount(count))
      .catch(() => !controller.signal.aborted && setUnreadCount(null));
    getInventoryLocations({ pageSize: 20, signal: controller.signal })
      .then((result) => !controller.signal.aborted && setLocations(result.items))
      .catch(() => !controller.signal.aborted && setLocations([]));
    return () => controller.abort();
  }, [pathname]);
  const primaryLocation = locations?.[0] ?? null;

  async function handleLogout() {
    // useLogout luôn xoá phiên cục bộ (kể cả khi API đăng xuất lỗi) nên chuyển về trang đăng nhập.
    await logout();
    router.replace("/public/login");
  }

  return (
    <div className="min-h-screen bg-[#f4f7fd] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[236px] flex-col border-r border-slate-200 bg-white">
        <div className="flex h-[70px] items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0d5b3a] text-white">
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
                d="m4 17 5-6 3 3 3-5 5 8H4Z"
              />
            </svg>
          </div>

          <div>
            <p className="text-[17px] font-bold leading-none text-[#123f2d]">
              TrekOps
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Kho vận hệ thống
            </p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-800">
            Nhân viên kho vận
          </span>
        </div>

        <nav className="mt-3 space-y-1 px-3">
          {navigation.map((item) => {
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition ${
                  active
                    ? "bg-[#226b4b] text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <NavIcon type={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
            </svg>
            {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
          {/* Kho thật từ GET /staff/inventory-locations */}
          <div className="rounded-xl border border-blue-100 bg-[#eef4ff] p-4 text-[11px] text-slate-700">
            {locations === null ? (
              <p className="text-slate-500">Đang tải thông tin kho...</p>
            ) : primaryLocation ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{primaryLocation.name}</span>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${primaryLocation.status === "ACTIVE" ? "bg-emerald-600" : "bg-slate-400"}`}
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-500">{primaryLocation.code}</p>
                {primaryLocation.address && (
                  <p className="mt-2 line-clamp-2 leading-4">{primaryLocation.address}</p>
                )}
                {locations.length > 1 && (
                  <p className="mt-2 text-[10px] text-slate-500">+{locations.length - 1} kho khác đang hoạt động</p>
                )}
              </>
            ) : (
              <p className="text-slate-500">Chưa có kho nào đang hoạt động.</p>
            )}
          </div>
        </div>
      </aside>

      <div className="pl-[236px]">
        <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#123f2d]">
              TrekOps Kho Vận
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-800">
              NHÂN VIÊN KHO VẬN
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden lg:block">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                />
              </svg>
              <input
                className="h-10 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs outline-none focus:border-emerald-600"
                placeholder="Tìm mã đơn"
              />
            </div>

            <button
              type="button"
              aria-label="Thông báo"
              className="relative text-slate-600"
            >
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
                  d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h11Zm0 0v1a3 3 0 1 1-6 0v-1"
                />
              </svg>
              {unreadCount !== null && unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <div className="text-right">
              <p className="text-xs font-semibold">{displayName}</p>
              <p className="text-[10px] text-slate-500">
                {roleLabel}
                {primaryLocation ? ` • ${primaryLocation.name}` : ""}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0d5b3a] text-xs font-semibold text-white">
              {initialsOf(displayName)}
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
