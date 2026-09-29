import React from 'react';

export const MyRoutesFilters = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex overflow-x-auto hide-scrollbar gap-1">
        <button className="px-4 py-2 bg-[#1B4332] text-white rounded-lg text-sm font-bold shrink-0">Tất cả (4)</button>
        <button className="px-4 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-sm font-medium shrink-0">Đã kiểm định (1)</button>
        <button className="px-4 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-sm font-medium shrink-0">Chờ duyệt (1)</button>
        <button className="px-4 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-sm font-medium shrink-0">Chưa kiểm định (1)</button>
        <button className="px-4 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg text-sm font-medium shrink-0">Bị từ chối (1)</button>
      </div>
      
      <div className="flex items-center gap-3 pr-2">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Tìm theo tên cung đường, địa danh (Tà Xùa...)" 
            className="pl-9 pr-4 py-2 w-full lg:w-72 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332]"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#1B4332]">
          <option>Mới cập nhật nhất</option>
          <option>Cũ nhất</option>
          <option>A-Z</option>
        </select>
      </div>
    </div>
  );
};
