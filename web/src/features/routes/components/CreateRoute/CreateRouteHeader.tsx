import React from 'react';
import Link from 'next/link';

export const CreateRouteHeader = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Link href="/routes" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900">Tạo Cung Đường Mới</h1>
          <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Khảo sát GPS & Đóng góp dữ liệu VFRS
          </span>
        </div>
        <p className="text-sm text-gray-500 max-w-2xl ml-8">
          Nhập thông tin tuyến đường, vẽ lộ trình trực tiếp hoặc tải lên tracklog GPX/KML và thiết lập các trạm dừng an toàn theo quy chuẩn đường mòn quốc gia.
        </p>
      </div>
      <div className="flex gap-3 shrink-0">
        <button className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg font-bold hover:bg-blue-100 flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          Upload GPX/KML File
        </button>
        <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-50 flex items-center gap-2 text-sm bg-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Tải mẫu chuẩn VFRS
        </button>
      </div>
    </div>
  );
};
