"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface BookingFormProps {
  onEquipmentCostChange?: (cost: number) => void;
}

export const BookingForm = ({ onEquipmentCostChange }: BookingFormProps) => {
  useEffect(() => {
    if (onEquipmentCostChange) {
      onEquipmentCostChange(0);
    }
  }, [onEquipmentCostChange]);

  return (
    <div className="flex-1 space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3 text-orange-800">
        <svg className="w-6 h-6 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <h4 className="font-semibold text-orange-900">Cảnh báo số lượng chỗ khả dụng</h4>
          <p className="text-sm mt-1">Chuyến đi hiện chỉ còn <span className="font-bold underline">4 chỗ trống</span> khả dụng. Bạn đang thao tác chọn cho 2 người (hợp lệ). Nếu nâng lên từ 5 thành viên, hệ thống sẽ tự động chuyển sang Danh sách chờ (Waiting List).</p>
        </div>
        <div className="ml-auto">
          <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-semibold rounded-md flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            Còn 4 / 12 chỗ
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Số lượng thành viên đăng ký</h3>
            <p className="text-sm text-gray-500">Tối đa 4 người cho mỗi đơn đặt chỗ trực tuyến. Trẻ em dưới 14 tuổi cần liên hệ Leader thẩm định trước.</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-2 border border-gray-100">
            <button className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-50">-</button>
            <div className="text-center w-12">
              <div className="font-bold text-lg text-gray-900">2</div>
              <div className="text-xs text-gray-500">thành viên</div>
            </div>
            <button className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-50">+</button>
          </div>
        </div>
      </div>

      {/* Member 1 */}
      <div className="bg-white rounded-lg shadow p-6 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm">01</div>
          <div>
            <h3 className="font-bold text-gray-900">Nguyễn Hùng (Người đặt chỗ chính)</h3>
            <p className="text-sm text-gray-500">Tài khoản cá nhân đã định danh CCCD và bảo hiểm</p>
          </div>
          <div className="ml-auto">
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Đã xác thực CCCD
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên đầy đủ <span className="text-red-500">*</span></label>
            <input type="text" defaultValue="Nguyễn Hùng" className="w-full bg-gray-100 border border-gray-200 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại liên lạc <span className="text-red-500">*</span></label>
            <input type="text" defaultValue="0912 345 678" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Số CCCD / Hộ chiếu <span className="text-red-500">*</span></label>
            <input type="text" defaultValue="001096012345" className="w-full bg-gray-100 border border-gray-200 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" readOnly />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Người liên hệ khẩn cấp (SOS) <span className="text-red-500">*</span></label>
            <input type="text" defaultValue="Nguyễn Thị Mai - 0988 123 456 (Chị ruột)" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tình trạng thể lực & tiền sử y khoa</label>
            <input type="text" defaultValue="Thể lực tốt, thường xuyên chạy bộ, không say độ cao, không tiền sử tim mạch hay hen suyễn" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kích thước áo đồng phục Trekking</label>
            <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option>Nam - Size L (1m68 - 1m75 | 65 - 73kg)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Điểm đón đoàn xe Limousine giường nằm</label>
            <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
              <option>Cổng công viên Cầu Giấy (Đường Thành Thái)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Member 2 */}
      <div className="bg-white rounded-lg shadow p-6 border border-red-200 relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-yellow-600 text-white flex items-center justify-center font-bold text-sm">02</div>
          <div>
            <h3 className="font-bold text-gray-900">Thành viên đồng hành #2</h3>
            <p className="text-sm text-gray-500">Khai báo thông tin định danh để đăng ký vé kiểm lâm & bảo hiểm</p>
          </div>
          <div className="ml-auto">
            <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1 border border-red-200">
              Cần bổ sung thông tin hợp lệ
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Form fields for member 2... */}
          <div className="col-span-2">
             <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
               <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <div>
                  <h5 className="text-sm font-medium text-blue-900">Cam kết an toàn & Bảo hộ y tế VFRS</h5>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" defaultChecked className="mt-1 rounded text-green-600 focus:ring-green-500" />
                      <span className="text-sm text-gray-700">Tôi xác nhận tất cả thành viên có đủ điều kiện thể lực tham gia trek cấp độ Trung bình (3/5) và đồng ý quy chuẩn bảo hộ VFRS.</span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" defaultChecked className="mt-1 rounded text-green-600 focus:ring-green-500" />
                      <span className="text-sm text-gray-700">Tuân thủ tuyệt đối chỉ dẫn của Leader Hoàng Nam và Porter bản địa trong suốt quá trình di chuyển qua vách núi hẹp.</span>
                    </label>
                  </div>
               </div>
             </div>
          </div>
        </div>
      </div>
      

      <div className="flex justify-between mt-6">
        <button className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Quay lại chi tiết chuyến đi
        </button>
        <a href="/my-trips" className="px-6 py-3 bg-[#1B4332] text-white font-medium rounded-lg hover:bg-[#1B4332]/90 flex items-center gap-2 shadow-lg">
          Tiếp tục: Rà soát & Thanh toán
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </a>
      </div>
    </div>
  );
};
