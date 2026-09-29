import React from 'react';
import Image from 'next/image';

export const AdminHeader = () => {
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-40 shrink-0">
      <div className="flex items-center gap-4 text-[13px] font-medium text-gray-600">
        <div className="flex items-center gap-1.5 hover:text-gray-900 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Trung tâm điều hành
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5 hover:text-gray-900 cursor-pointer">
          Vận hành hệ thống
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
        <div className="ml-4 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          <span className="text-xs font-bold text-gray-700">HỆ THỐNG: HOẠT ĐỘNG BÌNH THƯỜNG - 99.98%</span>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Tìm kiếm..." className="w-64 pl-9 pr-12 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
             <kbd className="hidden sm:inline-block border border-gray-200 rounded px-1.5 text-[10px] font-sans font-medium text-gray-400 bg-white">Ctrl</kbd>
             <kbd className="hidden sm:inline-block border border-gray-200 rounded px-1.5 text-[10px] font-sans font-medium text-gray-400 bg-white">K</kbd>
          </div>
        </div>
        
        <button className="relative text-gray-500 hover:text-gray-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">5</span>
        </button>
        
        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
          <div className="text-right hidden sm:block">
            <div className="text-[13px] font-bold text-gray-900 leading-tight">Trần Đăng Khoa</div>
            <div className="text-[10px] font-medium text-gray-500">System Administrator</div>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm relative">
            <Image src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=100&auto=format&fit=crop" alt="Admin" fill className="rounded-full object-cover" />
            <div className="absolute -bottom-1 -right-1 bg-green-700 text-white text-[8px] font-bold px-1 rounded-sm border border-white">SUPER ADMIN</div>
          </div>
        </div>
      </div>
    </header>
  );
};
