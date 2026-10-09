"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const AdminSidebar = () => {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(path);
  };

  const getLinkClass = (path: string) => {
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
      isActive(path) 
        ? "bg-[#305E41] text-white font-semibold shadow-sm" 
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    }`;
  };

  const getIconClass = (path: string) => {
    return `w-5 h-5 ${isActive(path) ? "opacity-90 text-white" : "text-gray-400"}`;
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen shrink-0 sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-gray-100 shrink-0">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1B5E41] text-white flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
          </div>
          <div>
            <div className="font-extrabold text-sm text-[#0F172A] tracking-tight leading-none">TREKKING SYSTEM</div>
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">• ADMIN OPS PORTAL</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        <Link href="/admin" className={getLinkClass("/admin")}>
          <svg className={getIconClass("/admin")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Dashboard
        </Link>
        <Link href="/admin/reports" className={getLinkClass("/admin/reports")}>
          <svg className={getIconClass("/admin/reports")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Báo cáo & Thống kê
        </Link>
        <Link href="/admin/destinations" className={getLinkClass("/admin/destinations")}>
          <svg className={getIconClass("/admin/destinations")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Quản lý Cung Đường Hệ Thống
        </Link>
        <Link href="/admin/complaints" className={getLinkClass("/admin/complaints")}>
          <svg className={getIconClass("/admin/complaints")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Xử lý Khiếu nại
        </Link>
        <Link href="/admin/leaders" className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${isActive('/admin/leaders') ? 'bg-[#305E41] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
          <div className="flex items-center gap-3">
            <svg className={getIconClass("/admin/leaders")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Quản lý Leader
          </div>
          <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
        </Link>
        <Link href="/admin/inventory" className={getLinkClass("/admin/inventory")}>
          <svg className={getIconClass("/admin/inventory")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          Quản lý Kho vật tư
        </Link>
        <Link href="/admin/rentals" className={getLinkClass("/admin/rentals")}>
          <svg className={getIconClass("/admin/rentals")} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          Thiết bị cho thuê
        </Link>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 text-[13px] font-semibold transition-colors cursor-pointer mt-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Cảnh báo & Cứu hộ SOS
          </div>
          <div className="flex flex-col items-end">
             <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-0.5">2</span>
             <span className="text-[8px] font-bold bg-red-100 text-red-600 px-1 rounded uppercase tracking-wider">OPEN</span>
          </div>
        </div>
      </nav>
      
      <div className="p-4 border-t border-gray-100">
         <div className="bg-emerald-50 rounded-lg p-3 text-emerald-800 border border-emerald-100">
            <div className="flex items-center gap-2 mb-1">
               <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
               <span className="text-xs font-bold">VFRS Satellite</span>
               <span className="ml-auto text-[10px] font-bold text-emerald-600 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>ONLINE</span>
            </div>
            <p className="text-[10px] text-emerald-700 leading-tight">Trạm viễn thông vệ tinh định vị khẩn cấp hoạt động 100%.</p>
            <button className="mt-3 w-full bg-red-700 hover:bg-red-800 text-white text-[11px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors">
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
               PHÁT LỆNH KHẨN CẤP
            </button>
         </div>
      </div>
    </aside>
  );
};
