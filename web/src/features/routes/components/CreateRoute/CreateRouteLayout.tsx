import React from 'react';
import { CreateRouteHeader } from './CreateRouteHeader';
import { CreateRouteForm } from './CreateRouteForm';
import { CreateRouteMap } from './CreateRouteMap';

export const CreateRouteLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-[1600px] w-full mx-auto px-4 py-8 flex-1 flex flex-col">
        <CreateRouteHeader />
        
        <div className="flex flex-col xl:flex-row gap-6 flex-1">
          {/* Left Column - Form */}
          <div className="w-full xl:w-5/12 shrink-0">
            <CreateRouteForm />
          </div>
          
          {/* Right Column - Map & Checkpoints */}
          <div className="flex-1 min-w-0">
            <CreateRouteMap />
          </div>
        </div>
      </div>
      
      {/* Bottom Action Bar */}
      <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-50">
        <div className="max-w-[1600px] w-full mx-auto px-4 flex justify-between items-center">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Đã lưu bản nháp tự động 1 phút trước • <span className="font-semibold text-amber-600">Trạng thái: Đang soạn thảo (Chưa xuất bản)</span>
          </div>
          <div className="flex gap-3">
            <button className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors">
              Hủy bỏ
            </button>
            <button className="px-6 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
              Lưu cung đường riêng tư
            </button>
            <button className="px-6 py-2.5 bg-[#1B4332] text-white rounded-lg text-sm font-bold hover:bg-[#153426] transition-colors shadow-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Lưu & Gửi yêu cầu kiểm duyệt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
