import React from 'react';
import Link from 'next/link';

export interface MyTripsHeaderProps {
  counts?: { upcoming: number; ongoing: number; completed: number; cancelled: number };
  typeCounts?: { all: number; bookings: number; privateTrips: number };
  activeTab?: 'ALL' | 'BOOKINGS' | 'PRIVATE' | 'INVITATIONS';
  onTabChange?: (tab: 'ALL' | 'BOOKINGS' | 'PRIVATE' | 'INVITATIONS') => void;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
}

export const MyTripsHeader = ({
  counts = { upcoming: 0, ongoing: 0, completed: 0, cancelled: 0 },
  typeCounts,
  activeTab = 'ALL',
  onTabChange,
  searchQuery = '',
  onSearchChange,
}: MyTripsHeaderProps) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">
            Hồ sơ hành trình cá nhân
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Chuyến Đi Của Tôi</h1>
          <p className="text-gray-500 mt-2 max-w-2xl text-sm leading-relaxed">
            Quản lý các tour trekking bạn đã đặt chỗ thành công cũng như các hành trình riêng tư bạn tự tổ chức.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm tên chuyến đi..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-4 py-2.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-gray-700"
            />
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/my-trips/create"
              className="flex-1 sm:flex-none justify-center bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200 flex items-center gap-2"
            >
              + Tổ chức chuyến riêng
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Tabs */}
        {typeCounts && onTabChange && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-gray-100/90 rounded-xl self-start">
            <button
              type="button"
              onClick={() => onTabChange('ALL')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tất cả ({typeCounts.all})
            </button>
            <button
              type="button"
              onClick={() => onTabChange('BOOKINGS')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'BOOKINGS'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tour đã đặt ({typeCounts.bookings})
            </button>
            <button
              type="button"
              onClick={() => onTabChange('PRIVATE')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'PRIVATE'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Chuyến tự tổ chức ({typeCounts.privateTrips})
            </button>
          </div>
        )}

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {counts.upcoming > 0 && (
            <span className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {counts.upcoming} Sắp tới
            </span>
          )}
          {counts.ongoing > 0 && (
            <span className="px-3.5 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-bold rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> {counts.ongoing} Đang diễn ra
            </span>
          )}
          {counts.completed > 0 && (
            <span className="px-3.5 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-bold rounded-full flex items-center gap-1.5">
              {counts.completed} Đã hoàn thành
            </span>
          )}
          {counts.cancelled > 0 && (
            <span className="px-3.5 py-1.5 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-full flex items-center gap-1.5">
              {counts.cancelled} Đã hủy
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
