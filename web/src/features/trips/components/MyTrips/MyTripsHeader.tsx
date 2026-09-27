import React from 'react';

export const MyTripsHeader = () => {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 font-medium uppercase tracking-wider mb-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        Hồ sơ hành trình cá nhân
      </div>
      <h1 className="text-3xl font-bold text-gray-900">Chuyến Đi Của Tôi</h1>
      <p className="text-gray-600 mt-2 max-w-2xl">Quản lý vé điện tử, điểm tập trung xe đưa đón, thông tin bảo hiểm rừng và các trang thiết bị leo núi đã liên kết cho từng chặng.</p>
      
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="px-3 py-1 bg-green-50 text-green-700 text-sm font-semibold rounded-full flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span> 2 Sắp tới
        </span>
        <span className="px-3 py-1 bg-yellow-50 text-yellow-700 text-sm font-semibold rounded-full flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span> 1 Đang diễn ra
        </span>
        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-semibold rounded-full flex items-center gap-2">
          4 Đã hoàn thành
        </span>
        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-semibold rounded-full flex items-center gap-2">
          1 Đã hủy
        </span>
        
        <div className="ml-auto flex gap-2">
           <div className="relative">
             <input type="text" placeholder="Tìm theo mã đặt chỗ, tên cung đường" className="bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-500" />
             <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
           <button className="bg-[#1B4332] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1B4332]/90 flex items-center gap-2">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             Khám phá chuyến mới
           </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mt-6 pt-2">
        <button className="px-4 py-3 font-semibold text-green-700 border-b-2 border-green-700">Sắp tới <span className="ml-1 bg-green-100 text-green-700 py-0.5 px-2 rounded-full text-xs">2</span></button>
        <button className="px-4 py-3 font-medium text-gray-500 hover:text-gray-700">Đang diễn ra <span className="ml-1 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">1</span></button>
        <button className="px-4 py-3 font-medium text-gray-500 hover:text-gray-700">Đã hoàn thành <span className="ml-1 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">4</span></button>
        <button className="px-4 py-3 font-medium text-gray-500 hover:text-gray-700">Đã hủy <span className="ml-1 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">1</span></button>
        
        <div className="ml-auto py-3 text-xs text-gray-500 flex items-center gap-1">
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          Tất cả vé đều kèm gói Bảo hiểm cứu hộ VFRS Trekker Shield
        </div>
      </div>
    </div>
  );
};
