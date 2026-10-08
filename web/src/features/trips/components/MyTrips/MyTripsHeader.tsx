import React from 'react';
import Link from 'next/link';

export const MyTripsHeader = ({ counts = { upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 } }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Hồ sơ hành trình cá nhân
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Chuyến Đi Của Tôi</h1>
          <p className="text-gray-500 mt-2 max-w-2xl text-sm leading-relaxed">
            Quản lý các chuyến đi riêng tư bạn đã tổ chức, mời bạn bè tham gia và theo dõi chi tiết điểm tập kết, hành trình trekking.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
           <div className="relative">
             <input type="text" placeholder="Tìm tên chuyến đi..." className="bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-gray-700" />
             <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
           
           <div className="flex items-center gap-2">
             <button className="flex-1 sm:flex-none justify-center bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-sm flex items-center gap-2">
               Khám phá
             </button>
             <Link href="/my-trips/create" className="flex-1 sm:flex-none justify-center bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200 flex items-center gap-2">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
               Tổ chức chuyến
             </Link>
           </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {counts.upcoming > 0 && (
          <span className="px-4 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {counts.upcoming} Sắp tới
          </span>
        )}
        {counts.ongoing > 0 && (
          <span className="px-4 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold rounded-full flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> {counts.ongoing} Đang diễn ra
          </span>
        )}
        {counts.completed > 0 && (
          <span className="px-4 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-bold rounded-full flex items-center gap-2">
            {counts.completed} Đã hoàn thành
          </span>
        )}
        {counts.cancelled > 0 && (
          <span className="px-4 py-1.5 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-full flex items-center gap-2">
            {counts.cancelled} Đã hủy
          </span>
        )}
      </div>
    </div>
  );
};
