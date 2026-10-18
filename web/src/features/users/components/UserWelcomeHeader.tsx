"use client";

import { useAuthStore } from "@/features/auth";

export const UserWelcomeHeader = () => {
  const user = useAuthStore((state) => state.user);
  const displayName =
    user?.fullName || user?.name || user?.email?.split("@")[0] || "Trekker";

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold mb-3">
          <svg className="w-3.5 h-3.5 text-[#154B36]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {user?.role === "LEADER" ? "Tài Khoản Mountain Leader" : "Tài Khoản Thành Viên Trekker"}
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2 tracking-tight flex flex-wrap items-center gap-2.5">
          <span>Chào mừng trở lại, {displayName}</span>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#154B36] shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18L14 6l-4 7-3-4-4 11z" />
            </svg>
          </span>
        </h1>
        <p className="text-[13px] text-gray-500 font-medium max-w-2xl">
          Sẵn sàng cho hành trình chinh phục đỉnh cao tiếp theo? Hệ thống an toàn đang theo dõi các tuyến đường bạn đã lưu.
        </p>
      </div>

      <div className="flex items-center gap-3 bg-white border border-gray-100 shadow-sm rounded-xl px-4 py-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#154B36] flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div>
          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Hành trình tích lũy</div>
          <div className="text-sm font-extrabold text-gray-900 leading-none">148.2 km • 6 Đỉnh</div>
        </div>
      </div>
    </div>
  );
};
