'use client';
import React from 'react';

export const TestHeader = () => {
  return (
    <div className="bg-[#1B4332] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Breadcrumb & Subnav */}
        <div className="flex justify-between items-center mb-4 text-xs">
          <div className="flex items-center gap-2 text-white/70">
            <span>Khám phá</span>
            <span>/</span>
            <span>Trở thành Leader</span>
            <span>/</span>
            <span className="font-bold text-white">Hồ sơ & Đánh giá</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-white/90">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Trạng thái hồ sơ
            </span>
            <span className="flex items-center gap-1.5 font-bold">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Bài thi trực tuyến
            </span>
          </div>
        </div>
        
        {/* Main Title & Action */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">Sát Hạch Kiến Thức An Toàn & Sơ Cứu VFRS</h1>
                <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">PHẦN 2</span>
              </div>
              <p className="text-xs text-white/70 mt-0.5">Quy trình Sinh tồn & Ứng phó Tình huống Khẩn cấp Ngoài Thực địa</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-[#D4A373] text-[#1B4332] rounded-lg px-4 py-2 flex items-center gap-3 border border-[#B3875B] font-bold">
              <div className="flex items-center gap-1.5 text-xs">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                THỜI GIAN CÒN LẠI
              </div>
              <div className="text-xl">24:14 <span className="text-xs font-normal">/ 30:00</span></div>
            </div>
            <button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              Nộp bài thi
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-medium">Câu hỏi 14 / 30 • Tiến độ: 46% hoàn thành</span>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-400"></div> Đã trả lời: 13/30</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white/30"></div> Chưa trả lời: 17/30</span>
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div className="bg-green-400 h-1.5 rounded-full" style={{ width: '46%' }}></div>
          </div>
        </div>
      </div>
      
      {/* Banner */}
      <div className="bg-[#E8F3EF] border-y border-[#1B4332]/10 py-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-xs text-[#1B4332]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Tiêu chuẩn An toàn: Wilderness First Aid (WFA)</span>
            <span className="flex items-center gap-1.5 text-orange-600 font-semibold"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> Giám sát thi độc lập: Đang ghi nhận hoạt động</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Hệ thống chấm tự động mã hóa AES-256
          </div>
        </div>
      </div>
    </div>
  );
};
