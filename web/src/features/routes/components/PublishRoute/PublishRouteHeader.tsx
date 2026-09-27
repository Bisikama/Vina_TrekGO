import React from 'react';
import Link from 'next/link';

export const PublishRouteHeader = () => {
  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Link href="/routes" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>
          <div className="flex items-center gap-2">
            <span className="bg-[#1B4332] text-white text-[10px] font-bold px-2 py-1 rounded">QUY CHUẨN VFRS 2.4</span>
            <span className="text-xs text-gray-500 font-mono">Mã dự thảo: <strong>DRAFT-GL-2024-K5</strong></span>
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mt-2">Thẩm định & Xuất bản Cung đường</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Đệ trình hồ sơ dữ liệu tracklog, trạm dừng và phương án an toàn thực địa lên Hội đồng An toàn Trekking Quốc gia (VFRS).
        </p>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <div className="text-[10px] font-bold text-blue-800 uppercase">Thời gian thẩm định</div>
          <div className="text-sm font-bold text-blue-900">24h - 48h làm việc</div>
        </div>
      </div>
    </div>
  );
};
