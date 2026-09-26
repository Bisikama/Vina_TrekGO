'use client';
import React, { useState } from 'react';

export const RegistrationHeader = ({ currentStep, isReady }: { currentStep: number, isReady?: boolean }) => {
  return (
    <div className="mb-6">
      <div className="flex gap-2 mb-3">
        <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded">CHỨNG NHẬN VFRS ACCREDITED</span>
        <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-1 rounded">KHÓA HUẤN LUYỆN K26 - ĐỢT 2</span>
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-3 leading-tight">
        Đăng Ký Trở Thành Mountain<br />Leader
      </h1>
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
        <p className="text-sm text-gray-600 max-w-xl leading-relaxed">
          Gia nhập đội ngũ dẫn đoàn chuyên nghiệp được bảo chứng bởi Hội đồng An toàn Trekking Quốc gia (VFRS). Hưởng mức thu nhập hấp dẫn, bảo hiểm tai nạn dã ngoại 500 triệu và đặc quyền trang bị leo núi.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3 shrink-0 w-full md:w-auto">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div className="font-bold text-green-900 text-sm">Thời gian thẩm định: 3 - 5 ngày</div>
            <div className="text-xs text-green-700">Phỏng vấn kỹ năng thực địa trực tuyến</div>
          </div>
        </div>
      </div>

      <div className="flex bg-gray-50 rounded-xl mt-8 p-1 gap-1 border border-gray-100 overflow-x-auto">
        <div className={`flex-1 min-w-[150px] ${currentStep === 1 ? 'bg-[#1B4332] shadow-md text-white' : 'bg-white border border-gray-200 shadow-sm text-gray-900'} rounded-lg p-3 flex items-center gap-2`}>
          <div className={`w-5 h-5 ${currentStep === 1 ? 'bg-white text-[#1B4332]' : 'bg-[#1B4332] text-white'} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>
            {currentStep > 1 ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : '1'}
          </div>
          <div>
            <div className={`text-[10px] ${currentStep === 1 ? 'text-white/80' : 'text-gray-500'} uppercase font-bold`}>{currentStep === 1 ? 'BƯỚC 1 (HIỆN TẠI)' : 'BƯỚC 1'}</div>
            <div className={`text-xs font-bold ${currentStep === 1 ? 'text-white' : 'text-gray-900'}`}>Thông tin cá nhân</div>
          </div>
        </div>
        <div className={`flex-1 min-w-[150px] ${currentStep === 2 ? 'bg-[#1B4332] shadow-md text-white' : currentStep > 2 ? 'bg-white border border-gray-200 shadow-sm text-gray-900' : 'bg-transparent text-gray-500'} rounded-lg p-3 flex items-center gap-2`}>
          <div className={`w-5 h-5 ${currentStep === 2 ? 'bg-white text-[#1B4332]' : currentStep > 2 ? 'bg-[#1B4332] text-white' : 'bg-gray-200 text-gray-500'} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>
            {currentStep > 2 ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : '2'}
          </div>
          <div>
            <div className={`text-[10px] ${currentStep === 2 ? 'text-white/80' : 'text-gray-400'} uppercase font-bold`}>{currentStep === 2 ? 'BƯỚC 2 (HIỆN TẠI)' : 'BƯỚC 2'}</div>
            <div className={`text-xs font-bold ${currentStep === 2 ? 'text-white' : currentStep > 2 ? 'text-gray-900' : 'text-gray-500'}`}>Kinh nghiệm thực địa</div>
          </div>
        </div>
        <div className={`flex-1 min-w-[150px] ${currentStep === 3 && !isReady ? 'bg-[#1B4332] shadow-md text-white' : isReady ? 'bg-white border border-gray-200 shadow-sm text-gray-900' : 'bg-transparent text-gray-500'} rounded-lg p-3 flex items-center gap-2`}>
          <div className={`w-5 h-5 ${currentStep === 3 && !isReady ? 'bg-white text-[#1B4332]' : isReady ? 'bg-[#1B4332] text-white' : 'bg-gray-200 text-gray-500'} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>
            {isReady ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : '3'}
          </div>
          <div>
            <div className={`text-[10px] ${currentStep === 3 && !isReady ? 'text-white/80' : 'text-gray-400'} uppercase font-bold`}>{currentStep === 3 && !isReady ? 'BƯỚC 3 (HIỆN TẠI)' : 'BƯỚC 3'}</div>
            <div className={`text-xs font-bold ${currentStep === 3 && !isReady ? 'text-white' : isReady ? 'text-gray-900' : 'text-gray-500'}`}>Hồ sơ & Chứng chỉ</div>
          </div>
        </div>
        <div className={`flex-1 min-w-[150px] ${isReady ? 'bg-[#1B4332] shadow-md text-white' : 'bg-transparent'} rounded-lg p-3 flex items-center gap-2`}>
          <div className={`w-5 h-5 ${isReady ? 'bg-white text-[#1B4332]' : 'bg-gray-200 text-gray-500'} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>4</div>
          <div>
            <div className={`text-[10px] ${isReady ? 'text-white/80' : 'text-gray-400'} uppercase font-bold`}>{isReady ? 'BƯỚC 4 (HIỆN TẠI)' : 'BƯỚC 4'}</div>
            <div className={`text-xs font-bold ${isReady ? 'text-white' : 'text-gray-500'}`}>Xem lại & Gửi duyệt</div>
          </div>
        </div>
      </div>
      
      {currentStep === 3 && !isReady && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <div className="font-bold text-red-900 text-sm">Chưa thể gửi hồ sơ: Bạn còn thiếu 01 tài liệu bắt buộc</div>
              <div className="text-xs text-red-700 mt-1">
                Mục <span className="underline font-medium">Căn cước công dân / Hộ chiếu (mặt sau)</span> chưa được đính kèm. Vui lòng bổ sung để hệ thống kích hoạt nút nộp hồ sơ ở Bước 4.
              </div>
            </div>
          </div>
          <button className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shrink-0 hover:bg-red-700 transition-colors">Bổ sung ngay</button>
        </div>
      )}
    </div>
  );
};
