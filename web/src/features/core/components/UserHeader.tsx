"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore, useCurrentUser } from "@/features/auth";

export const UserHeader = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { getCurrentUser } = useCurrentUser();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMobileMenuOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  const displayName =
    user?.fullName || user?.name || user?.email?.split("@")[0] || "Đang tải...";

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-[100] w-full max-w-full overflow-x-clip">
      {/* Top thin bar */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-[#F8FAFC] px-4 py-1.5 text-[10px] font-medium text-gray-500 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-1.5 truncate">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="truncate">Khám phá vùng lõi núi Việt Nam</span>
          </span>

          <span className="hidden items-center gap-1.5 lg:flex whitespace-nowrap">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            Hệ thống cảnh báo an toàn hoạt động tốt
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <svg
              className="w-3.5 h-3.5 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
              />
            </svg>
            Bà Đen 28°C, Nắng đẹp
          </span>

          <span className="hidden items-center gap-1.5 md:flex whitespace-nowrap">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Đang theo dõi 124 đoàn
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="flex h-16 items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white overflow-hidden text-white shadow-sm">
            <Image
              src="/1789664610087_6373285567144304261_g1044842043242625655_88c212cbd53a46aec527c6c81b77f57b.jpg"
              alt="Logo"
              width={32}
              height={32}
              className="object-cover h-full w-full"
            />
          </div>

          <div className="whitespace-nowrap">
            <div className="text-sm font-extrabold leading-none tracking-tight text-[#0F172A]">
              Trekking System
            </div>

            <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-[#4ADE80]">
              Vina Outdoors
            </div>
          </div>
        </Link>

        {/* Desktop Navigation (only on xl+ so it never crushes medium/laptop viewports) */}
        <nav className="hidden items-center gap-3 2xl:gap-5 text-xs 2xl:text-[13px] font-bold text-gray-600 xl:flex min-w-0">
          <Link
            href="/explore"
            className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
          >
            Khám phá
          </Link>

          <Link
            href="/trips"
            className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
          >
            Chuyến đi
          </Link>

          <Link
            href="/my-trips"
            className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
          >
            Chuyến đi của tôi
          </Link>

          <Link
            href="/my-routes"
            className="whitespace-nowrap hover:text-[#1B5E41] transition-colors"
          >
            Cung đường của tôi
          </Link>

          <Link
            href="/invite"
            className="flex items-center gap-1 whitespace-nowrap hover:text-[#1B5E41] transition-colors"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
              />
            </svg>
            Nhập mã mời
          </Link>

          <Link
            href="/rentals"
            className="flex items-center gap-1 whitespace-nowrap hover:text-[#1B5E41] transition-colors"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM10 7V5h4v2"
              />
            </svg>
            Thuê thiết bị
          </Link>

          <Link
            href="/leader-registration"
            className="flex items-center gap-1 whitespace-nowrap hover:text-[#1B5E41] transition-colors"
          >
            Trở thành Leader
            <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] leading-none text-black">
              PRO
            </span>
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-full bg-[#DC2626] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-red-700 md:flex whitespace-nowrap shrink-0"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            SOS 1800-9988
          </button>

          <button
            type="button"
            aria-label="Thông báo"
            className="relative p-1 text-gray-400 hover:text-gray-600 shrink-0"
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
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full border border-white bg-red-500" />
          </button>

          <div className="flex items-center gap-2.5 sm:gap-3 border-l border-gray-200 pl-2.5 sm:pl-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-200">
                <Image
                  src={
                    user?.avatar ||
                    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop"
                  }
                  alt="User Avatar"
                  width={32}
                  height={32}
                  className="object-cover w-full h-full"
                />
              </div>

              <div className="hidden text-left sm:block max-w-[110px] 2xl:max-w-[150px]">
                <div className="text-[12px] font-bold leading-tight text-gray-900 truncate">
                  {displayName}
                </div>

                <div className="text-[10px] font-medium text-gray-500 truncate">
                  {user?.role === "LEADER" ? "Leader PRO" : "Trekker"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                logout();
                window.location.href = "/public/login";
              }}
              className="hidden sm:inline-flex cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
            >
              Đăng xuất
            </button>
          </div>

          {/* Mobile / Tablet / Compact Laptop Hamburger Button (< xl) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileMenuOpen}
            className="inline-flex xl:hidden items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors shrink-0 cursor-pointer"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Responsive Dropdown Menu for < xl screens */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-gray-100 bg-white px-4 pt-3 pb-4 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[13px] font-bold text-gray-700">
            <Link
              href="/explore"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
            >
              Khám phá
            </Link>
            <Link
              href="/trips"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
            >
              Chuyến đi
            </Link>
            <Link
              href="/my-trips"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
            >
              Chuyến đi của tôi
            </Link>
            <Link
              href="/my-routes"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
            >
              Cung đường của tôi
            </Link>
            <Link
              href="/invite"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
            >
              Nhập mã mời
            </Link>
            <Link
              href="/rentals?bookingId=booking_001"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
            >
              Thuê thiết bị
            </Link>
            <Link
              href="/leader-registration"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-emerald-50 hover:text-[#1B5E41] transition-colors"
            >
              <span>Trở thành Leader</span>
              <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] leading-none text-black">
                PRO
              </span>
            </Link>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 sm:hidden">
            <div className="text-xs font-bold text-gray-800 truncate">
              {displayName} ({user?.role === "LEADER" ? "Leader PRO" : "Trekker"})
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.href = "/public/login";
              }}
              className="cursor-pointer whitespace-nowrap rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      {/* Tracking Sub-bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#154B36] px-4 py-2 text-[11px] font-medium text-white sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30 whitespace-nowrap shrink-0">
            GPS TRACKING ON
          </span>
          <span className="hidden md:inline truncate opacity-90">
            Thời tiết Núi Bà Đen (Tây Ninh): 28°C • Độ ẩm 65% • Nắng ráo, mây quang đãng
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 opacity-90 shrink-0 ml-auto">
          <span className="hidden sm:flex items-center gap-1.5 whitespace-nowrap">
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            Vệ tinh Garmin InReach Sẵn sàng
          </span>

          <span className="flex items-center gap-1.5 sm:border-l sm:border-white/20 sm:pl-4 whitespace-nowrap">
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Trung tâm điều phối 1800-9988
          </span>
        </div>
      </div>
    </header>
  );
};