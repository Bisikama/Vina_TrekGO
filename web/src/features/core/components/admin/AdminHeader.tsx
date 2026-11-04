"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/features/auth";
import {
  STAFF_ROLE_LABELS,
  getUnreadNotificationCount,
  initialsOf,
} from "@/features/rentals/services/staff-overview.api";

// Đầu trang Admin: tên, vai trò lấy từ phiên đăng nhập; số thông báo từ /notifications/unread-count.
export const AdminHeader = () => {
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const displayName = user?.fullName || user?.email?.split("@")[0] || "Quản trị viên";
  const roleLabel = STAFF_ROLE_LABELS[user?.role ?? ""] ?? "Quản trị viên";
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getUnreadNotificationCount(controller.signal)
      .then((count) => !controller.signal.aborted && setUnreadCount(count))
      .catch(() => !controller.signal.aborted && setUnreadCount(null));
    return () => controller.abort();
  }, [pathname]);

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-40 shrink-0">
      <div className="text-[13px] font-medium text-gray-600">Trang quản trị</div>

      <div className="flex items-center gap-6">
        <div className="relative text-gray-500" title="Thông báo chưa đọc">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          {unreadCount && unreadCount > 0 ? (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full border-2 border-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
          <div className="text-right hidden sm:block">
            <div className="text-[13px] font-semibold text-gray-900 leading-tight">{displayName}</div>
            <div className="text-[11px] text-gray-500">{roleLabel}</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-medium">
            {initialsOf(displayName)}
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/public/login";
            }}
            className="ml-2 cursor-pointer rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
};
