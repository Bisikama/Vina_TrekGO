import React from 'react';

export const BookingSteps = () => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 font-medium">MÃ: TX-2411-VFRS</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500 text-sm">15/11 - 17/11/2024 (2N1D)</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-500 text-sm">Leader: Hoàng Nam (WFA Pro)</span>
        </div>
        <div>
          <span className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full font-medium">
            Đang mở cổng đặt chỗ
          </span>
        </div>
      </div>
      
      {/* Steps Indicator */}
      <div className="flex mt-6 gap-4">
        <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">1</div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Bước 1 / 3</div>
            <div className="font-semibold text-gray-900">Thành viên tham gia</div>
          </div>
        </div>
        <div className="flex-1 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold">2</div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Bước 2 / 3</div>
            <div className="font-semibold text-gray-400">Rà soát & Thanh toán</div>
          </div>
        </div>
        <div className="flex-1 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold">3</div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Bước 3 / 3</div>
            <div className="font-semibold text-gray-400">Hoàn tất đặt chỗ</div>
          </div>
        </div>
      </div>
    </div>
  );
};
