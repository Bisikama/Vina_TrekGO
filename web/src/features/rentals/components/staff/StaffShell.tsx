"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { useLogout } from "@/features/auth/hooks/useLogout";

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
            <p className="text-[17px] font-black leading-none text-[#123f2d]">
              TrekOps
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Kho vận hệ thống
            </p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-800">
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
          <div className="rounded-xl border border-blue-100 bg-[#eef4ff] p-4 text-[11px] text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-bold">Hub North-01</span>
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
            </div>
            <p className="mt-2">Kho Tổng Cầu Giấy</p>
            <div className="mt-3 flex items-center justify-between">
              <span>RFID sẵn sàng</span>
              <span className="font-mono">1800-8735</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="pl-[236px]">
        <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-[#123f2d]">
              TrekOps Kho Vận
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold text-emerald-800">
              NHÂN VIÊN KHO VẬN
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-medium text-slate-600">
              Live sync: 100% telemetry
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
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
                4
              </span>
            </button>

            <div className="text-right">
              <p className="text-xs font-bold">Nguyễn Văn An</p>
              <p className="text-[10px] text-slate-500">
                Thủ kho ca sáng • Cầu Giấy
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0d5b3a] text-xs font-black text-white">
              AN
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
