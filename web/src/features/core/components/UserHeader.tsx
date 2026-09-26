"use client";

import Link from "next/link";
import Image from "next/image";

export const UserHeader = () => {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      {/* Top thin bar */}
      <div className="bg-[#F8FAFC] py-1.5 px-4 sm:px-6 lg:px-8 border-b border-gray-100 flex justify-between items-center text-[10px] text-gray-500 font-medium">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Khám phá vùng lõi núi Việt Nam
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
            Hệ thống cảnh báo an toàn hoạt động tốt
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            Fansipan 15°C, Gió nhẹ
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Đang theo dõi 124 đoàn
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1B5E41] text-white flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
          </div>
          <div>
            <div className="font-extrabold text-sm text-[#0F172A] tracking-tight leading-none">Trekking System</div>
            <div className="text-[9px] font-bold text-[#4ADE80] uppercase tracking-widest mt-0.5">Vina Outdoors</div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-[13px] font-bold text-gray-600">
          <Link href="/explore" className="hover:text-[#1B5E41]">Khám phá</Link>
          <Link href="/trips" className="hover:text-[#1B5E41]">Chuyến đi</Link>

          <Link href="/my-trips" className="hover:text-[#1B5E41]">Chuyến đi của tôi</Link>
          <Link href="/my-routes" className="hover:text-[#1B5E41]">Cung đường của tôi</Link>
          <Link href="/leader-registration" className="flex items-center gap-1 hover:text-[#1B5E41]">
            Trở thành Leader
            <span className="bg-amber-400 text-[9px] px-1.5 py-0.5 rounded text-black leading-none">PRO</span>
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <button className="hidden sm:flex items-center gap-2 bg-[#DC2626] hover:bg-red-700 text-white px-3 py-1.5 rounded-full text-xs font-bold transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            SOS 1800-9988
          </button>
          
          <button className="relative text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>

          <div className="flex items-center gap-4 pl-4 border-l border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                <Image src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop" alt="User Avatar" width={32} height={32} />
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-[13px] font-bold text-gray-900 leading-tight">Nguyễn Hùng</div>
                <div className="text-[10px] text-gray-500 font-medium">Level 3 Trekker</div>
              </div>
            </div>
            
            <button 
              onClick={() => {
                document.cookie = "mock_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                window.location.href = "/public/login";
              }}
              className="text-[11px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>

      {/* Tracking Sub-bar */}
      <div className="bg-[#154B36] text-white py-2 px-4 sm:px-6 lg:px-8 flex justify-between items-center text-[11px] font-medium">
        <div className="flex items-center gap-2">
          <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">GPS TRACKING ON</span>
          <span className="hidden sm:inline opacity-90">Thời tiết vùng núi Tây Bắc: 16°C • Độ ẩm 78% • Gió nhẹ, nắng mỏng Tà Xùa</span>
        </div>
        <div className="flex items-center gap-4 opacity-90">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            Vệ tinh Garmin InReach Sẵn sàng
          </span>
          <span className="flex items-center gap-1.5 border-l border-white/20 pl-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Trung tâm điều phối 1800-9988
          </span>
        </div>
      </div>
    </header>
  );
};
