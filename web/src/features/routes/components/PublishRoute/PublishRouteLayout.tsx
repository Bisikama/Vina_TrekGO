import React from 'react';
import { PublishRouteHeader } from './PublishRouteHeader';
import { RouteSummaryCard } from './RouteSummaryCard';
import { VFRSTestChecklist } from './VFRSTestChecklist';
import { PublishNotesForm } from './PublishNotesForm';
import Link from 'next/link';

export const PublishRouteLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full">
        <PublishRouteHeader />
        <RouteSummaryCard />
        <VFRSTestChecklist />
        <PublishNotesForm />
      </div>
      
      {/* Bottom Action Bar */}
      <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-50">
        <div className="max-w-5xl mx-auto px-4 flex justify-between items-center w-full">
          <Link href="/routes" className="text-sm font-bold text-gray-500 hover:text-gray-900 flex items-center gap-2 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Hủy bỏ (Quay lại Cung đường của tôi)
          </Link>
          <div className="flex gap-3">
            <button className="px-6 py-2.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors shadow-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              Lưu bản nháp
            </button>
            <button className="px-6 py-2.5 bg-[#1B4332] text-white rounded-lg text-sm font-bold hover:bg-[#153426] transition-colors shadow-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Gửi Hồ Sơ Thẩm Định VFRS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
