import React from 'react';
import { MyRoutesHeader } from './MyRoutesHeader';
import { MyRoutesStats } from './MyRoutesStats';
import { MyRoutesFilters } from './MyRoutesFilters';
import { MyRouteCard } from './MyRouteCard';
import Link from 'next/link';

export const MyRoutesList = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <MyRoutesHeader />
      <MyRoutesStats />
      <MyRoutesFilters />
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Chưa có cung đường nào</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Bạn chưa tạo hoặc nhập bất kỳ dữ liệu định vị GPS (Tracklog) nào. Hãy bắt đầu bằng cách tạo cung đường khảo sát đầu tiên.
        </p>
        <Link href="/my-routes/create" className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#153426] text-white font-bold rounded-lg transition-colors inline-block mt-2">
          + Tạo cung đường mới
        </Link>
      </div>
    </div>
  );
};
