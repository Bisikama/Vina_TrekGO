import React from 'react';

export const PersonalInfoSection = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#1B4332] text-white flex items-center justify-center font-bold text-sm">1</div>
          <h3 className="font-bold text-gray-900 text-lg">Thông tin cá nhân</h3>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">Họ và tên</label>
          <input type="text" defaultValue="Nguyễn Hùng" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">Số điện thoại</label>
          <input type="text" defaultValue="0988 771 234" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">Email</label>
          <input type="email" defaultValue="hung.nguyen@outdoor.vn" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-500" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1.5">Ngày sinh</label>
          <input type="date" defaultValue="1992-05-15" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-500" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-gray-700 mb-1.5">Địa chỉ thường trú</label>
          <input type="text" defaultValue="Quận Cầu Giấy, Hà Nội" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-green-500" />
        </div>
      </div>
    </div>
  );
};
