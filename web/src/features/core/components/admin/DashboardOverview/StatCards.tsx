import React from 'react';

export const StatCards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
             +5.2%
          </span>
        </div>
        <div className="text-xs text-gray-500 font-medium mb-1">TỔNG NGƯỜI DÙNG</div>
        <div className="text-2xl font-bold text-gray-900 mb-3">24.850</div>
        <div className="flex items-center gap-2 text-xs font-medium bg-gray-50 p-2 rounded text-gray-600">
           <span className="font-bold text-gray-900">21.4k</span> Trekker • <span className="font-bold text-gray-900">450</span> Leader
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </div>
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
             100% GPS
          </span>
        </div>
        <div className="text-xs text-gray-500 font-medium mb-1">CHUYẾN ĐI ĐANG CHẠY</div>
        <div className="text-2xl font-bold text-gray-900 mb-3">38 đoàn</div>
        <div className="flex justify-between items-center text-xs font-medium bg-gray-50 p-2 rounded text-gray-600">
           <span>Trên núi: <span className="font-bold text-gray-900">18</span></span>
           <span>Chuẩn bị: <span className="font-bold text-gray-900">20</span></span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
          </div>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
             &gt;48h: 1
          </span>
        </div>
        <div className="text-xs text-gray-500 font-medium mb-1">CUNG ĐƯỜNG CHỜ DUYỆT</div>
        <div className="text-2xl font-bold text-gray-900 mb-3">4 yêu cầu</div>
        <div className="text-xs font-medium bg-gray-50 p-2 rounded text-gray-600">
           2 tuyến Cấp 4 • Cần thực địa
        </div>
      </div>

      <div className="bg-red-50 rounded-xl shadow-sm border border-red-100 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500 rounded-full opacity-10 -mr-8 -mt-8"></div>
        <div className="flex justify-between items-start mb-2 relative z-10">
          <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
             ĐANG ĐIỀU PHỐI
          </span>
        </div>
        <div className="text-xs text-red-700 font-bold mb-1 relative z-10">SOS ĐANG XỬ LÝ</div>
        <div className="text-2xl font-bold text-red-700 mb-3 relative z-10">2 vụ việc</div>
        <div className="text-[11px] font-bold bg-white/60 p-2 rounded text-red-800 relative z-10 line-clamp-1">
           Lảo Thẩn: Chấn thương • Bạch Mộc: Lạc
        </div>
      </div>
    </div>
  );
};
