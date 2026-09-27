import React from 'react';
import Link from 'next/link';

export const TripCardCompleted = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gray-400"></div>
      
      <div className="p-6 ml-1.5">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 xl:w-1/4 shrink-0">
            <div className="aspect-[4/3] rounded-lg overflow-hidden relative grayscale-[30%]">
              <img src="https://images.unsplash.com/photo-1541849546-216549281001?q=80&w=400&auto=format&fit=crop" className="object-cover w-full h-full" alt="Tà Xùa" />
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="absolute bottom-2 left-2 bg-white/90 text-gray-900 text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm">
                #TX-2411-8924
              </div>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Đã hoàn thành</span>
                <span className="text-gray-400 text-xs">• 15/11 - 17/11/2024</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2">Chinh phục Sống Lưng Khủng Long Tà Xùa</h3>
              
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span>Leader: <span className="font-medium text-gray-900">Hoàng Nam</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <span>Nhóm: <span className="font-medium text-gray-900">12 thành viên</span></span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/reviews/new/TX-2411-8924" className="bg-orange-500 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Đánh giá nhận 150 điểm
              </Link>
              <button className="bg-white border border-gray-300 text-gray-700 font-bold px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm">
                Xem lại lịch trình
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
