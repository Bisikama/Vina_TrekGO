'use client';
import React from 'react';
import Link from 'next/link';

export const ProgressHeader = () => {
  return (
    <div className="mb-8">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-gray-900 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Khám phá
          </Link>
          <span>/</span>
          <Link href="#" className="hover:text-gray-900">Trở thành Leader</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Hồ sơ & Đánh giá</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-gray-900">
            <svg className="w-4 h-4 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Trạng thái hồ sơ
          </span>
          <span className="flex items-center gap-1.5 text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Bài thi trực tuyến
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center bg-gray-50 rounded-xl p-2 border border-gray-100 mb-8 overflow-x-auto">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 px-3 py-1.5 min-w-max">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Chế độ mô phỏng trạng thái xét duyệt:
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-[#1B4332] text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0">1. Đang phỏng vấn</button>
          <button className="bg-transparent hover:bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors">2. Đã phê duyệt</button>
          <button className="bg-transparent hover:bg-gray-100 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors">3. Từ chối hồ sơ</button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[#1B4332] text-[10px] font-bold uppercase tracking-wider mb-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          QUY TRÌNH KIỂM TRA NĂNG LỰC DẪN ĐOÀN VFRS 2024
        </div>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-3">Tiến Độ Tuyển Chọn Mountain Leader</h1>
            <div className="flex items-center gap-4 text-xs">
              <span className="bg-blue-50 text-blue-700 font-bold px-2 py-1 rounded">#LDR-2024-8891</span>
              <span className="text-gray-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span> Ngày nộp: <b className="text-gray-900">14/11/2024 09:30</b></span>
              <span className="text-orange-600 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span> Thời gian xử lý dự kiến: <b className="text-orange-700">10 ngày làm việc</b></span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
            <div className="relative">
              <img src="https://images.unsplash.com/photo-1534447677768-be436bb09401?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80" alt="Avatar" className="w-10 h-10 rounded-lg object-cover" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">Nguyễn Hùng</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="bg-green-100 text-green-700 text-[8px] font-bold px-1.5 py-0.5 rounded">Level 3 Trekker</span>
                <span className="text-[10px] text-gray-500">Ứng viên Leader</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
