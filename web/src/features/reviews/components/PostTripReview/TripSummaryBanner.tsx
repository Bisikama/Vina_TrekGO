import React from 'react';

export const TripSummaryBanner = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-center gap-6 mb-8">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-20 h-20 rounded-xl overflow-hidden relative shrink-0">
          <img src="https://images.unsplash.com/photo-1541849546-216549281001?q=80&w=200&auto=format&fit=crop" className="object-cover w-full h-full" alt="Tà Xùa" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Hành trình đã kết thúc an toàn
          </div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">Chinh phục Sống Lưng<br/>Khủng Long Tà Xùa</h2>
          <div className="text-xs text-gray-500 mt-1">Mùa Săn Mây Đại Ngàn • Sơn La</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full md:w-auto border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
        <div>
          <div className="text-[10px] text-gray-500 mb-1 font-medium">Thời gian thực hiện</div>
          <div className="text-sm font-bold text-gray-900">15/11 - 17/11/2024</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Thời tiết: Đạt 100% mây</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1 font-medium">Leader đồng hành</div>
          <div className="text-sm font-bold text-gray-900">Hoàng Nam</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Chứng chỉ WFA Cấp 3</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1 font-medium">Gói thiết bị kho</div>
          <div className="text-sm font-bold text-gray-900">04 Thiết bị VFRS</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Đơn thuê #RT-2411-9820</div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-1 font-medium">Trạng thái ghi nhận</div>
          <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Đã xác thực GPS
          </div>
        </div>
      </div>
    </div>
  );
};
