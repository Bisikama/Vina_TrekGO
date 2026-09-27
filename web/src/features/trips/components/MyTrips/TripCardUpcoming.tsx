import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export const TripCardUpcoming = () => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
      <div className="bg-green-50 px-6 py-3 flex items-center justify-between border-b border-green-100">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-bold text-gray-900">MÃ ĐẶT CHỖ: TX-2411-8924</span>
          <button className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Sao chép
          </button>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500">Ngày đặt: 02/11/2024</span>
        </div>
        <span className="px-3 py-1 bg-green-200 text-green-800 text-sm font-semibold rounded-full flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Đã xác nhận (Confirmed)
        </span>
      </div>

      <div className="p-6 flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-72 shrink-0">
          <div className="relative h-40 rounded-lg overflow-hidden">
            <Image src="https://images.unsplash.com/photo-1541849546-216549281001?q=80&w=2070&auto=format&fit=crop" alt="Ta Xua" fill className="object-cover" />
            <div className="absolute top-2 left-2 bg-gray-900/80 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
              <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
              Khởi hành trong 3 ngày nữa
            </div>
            <div className="absolute bottom-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">
              Độ khó: Thử thách (Level 3)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-xs text-gray-500 mb-1">THỜI LƯỢNG</div>
              <div className="font-bold text-sm">2N1Đ</div>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-xs text-gray-500 mb-1">QUÃNG ĐƯỜNG</div>
              <div className="font-bold text-sm">14.8 km</div>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-xs text-gray-500 mb-1">ĐỘ CAO MAX</div>
              <div className="font-bold text-sm">2.865 m</div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              BẮC YÊN, SƠN LA
            </p>
            <h3 className="text-xl font-bold text-gray-900">Chinh phục Sống Lưng Khủng Long Tà Xùa - Mùa Săn Mây Đại Ngàn</h3>
          </div>

          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <div>
                <span className="text-gray-500">Lịch trình: </span>
                <span className="font-medium">15/11/2024 — 17/11/2024</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <div>
                <span className="text-gray-500">Leader phụ trách: </span>
                <span className="font-medium">Hoàng Nam <span className="text-xs font-normal text-gray-500">(WFA Pro • 4.95★)</span></span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              <div>
                <span className="text-gray-500">Thành viên (2 người): </span>
                <span className="font-medium">Nguyễn Hùng, Trần Minh Trí</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <div>
                <span className="text-gray-500">Điểm hẹn xe: </span>
                <span className="font-medium">20:00, 15/11 tại CV Cầu Giấy (Xe 29B-...)</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-100">

            <div className="flex items-center gap-2 text-sm">
               <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
               <span className="text-gray-700">Đã thanh toán 100%: <span className="font-semibold text-gray-900">5.092.000₫</span></span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-gray-500">
             <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
             Bảo hiểm rủi ro địa hình số #BH-VFRS-902184
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-end mt-4">
            <button className="text-red-600 text-sm font-medium hover:underline px-3 py-2">Hủy đặt chỗ</button>

            <button className="bg-[#1B4332] text-white text-sm font-medium px-4 py-2 rounded flex items-center gap-2 hover:bg-[#1B4332]/90">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              Xem chi tiết & Vé QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
