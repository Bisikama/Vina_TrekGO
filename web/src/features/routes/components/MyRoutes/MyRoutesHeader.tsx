import React from 'react';
import Link from 'next/link';

export const MyRoutesHeader = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">Cung Đường Của Tôi</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-2xl">
          Quản lý dữ liệu định vị GPS, sơ đồ trạm nghỉ (checkpoints) và quy chuẩn an toàn cho các tuyến đường bạn đã khảo sát hoặc tạo mới.
        </p>
      </div>
      <div className="flex gap-3 shrink-0">
        <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-50 flex items-center gap-2 text-sm bg-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          Nhập file GPX / KML
        </button>
        <Link href="/routes/create" className="px-4 py-2 bg-[#1B4332] text-white rounded-lg font-bold hover:bg-[#153426] flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Tạo cung đường mới
        </Link>
      </div>
    </div>
  );
};
