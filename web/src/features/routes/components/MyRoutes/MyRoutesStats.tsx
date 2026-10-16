import React from 'react';

export const MyRoutesStats = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Tổng cộng</div>
          <div className="text-3xl font-extrabold text-gray-900">0</div>
          <div className="text-sm text-gray-500 mt-1">Tuyến khảo sát</div>
        </div>
        <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Đã kiểm định</div>
          <div className="flex items-center gap-2">
            <div className="text-3xl font-extrabold text-gray-900">0</div>
            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">VFRS</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">Công khai cộng đồng</div>
        </div>
        <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Chờ duyệt</div>
          <div className="text-3xl font-extrabold text-gray-900">0</div>
          <div className="text-sm text-gray-500 mt-1">Đang phản hồi</div>
        </div>
        <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cần xử lý</div>
          <div className="text-3xl font-extrabold text-gray-400">0</div>
          <div className="text-sm text-gray-400 mt-1 font-medium">Không có lỗi</div>
        </div>
        <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center text-red-500">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
      </div>
    </div>
  );
};
