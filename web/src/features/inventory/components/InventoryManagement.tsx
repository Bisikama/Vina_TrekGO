"use client";

import React, { useState } from 'react';

const inventoryItems = [
  {
    id: 'SKU: TENT-NH-24P',
    name: 'Lều cắm trại 2-4 người',
    brand: 'Naturehike Cloud Up / Mongar 2',
    total: 280,
    available: 190,
    tour: 72,
    maintenance: 18,
    status: 'ok',
    icon: '⛺'
  },
  {
    id: 'SKU: SLEEP-MS-10',
    name: 'Túi ngủ chịu lạnh âm độ',
    brand: 'Nhiệt độ biên: -5°C -> 10°C',
    total: 350,
    available: 245,
    tour: 90,
    maintenance: 15,
    status: 'ok',
    icon: '🛏️'
  },
  {
    id: 'SKU: POLE-BD-PRO',
    name: 'Gậy trekking hợp kim carbon',
    brand: 'Black Diamond Trail Pro',
    total: 320,
    available: 85,
    tour: 210,
    maintenance: 25,
    status: 'warning',
    icon: '🦯'
  },
  {
    id: 'SKU: COM-MOTO-T82',
    name: 'Bộ đàm cự ly xa UHF/VHF',
    brand: 'Motorola Extreme 446MHz',
    total: 120,
    available: 32,
    tour: 76,
    maintenance: 12,
    status: 'warning',
    icon: '📻'
  },
  {
    id: 'SKU: PACK-OSP-70',
    name: 'Balo trợ lực 50L - 70L',
    brand: 'Osprey Atmos AG & Deuter',
    total: 160,
    available: 112,
    tour: 40,
    maintenance: 8,
    status: 'ok',
    icon: '🎒'
  },
  {
    id: 'SKU: HEAD-BD-STRM',
    name: 'Đèn đội đầu chống nước & Pin',
    brand: 'Black Diamond Storm 450lm',
    total: 100,
    available: 138,
    tour: 48,
    maintenance: 4,
    status: 'ok',
    icon: '🔦'
  }
];

export const InventoryManagement = () => {
  return (
    <div className="p-6">
      {/* Alert */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start justify-between">
        <div className="flex gap-3">
          <div className="bg-red-100 p-2 rounded-lg text-red-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <h4 className="font-bold text-red-800 text-sm">Cảnh báo thiếu hụt cấp độ 2: Bộ đàm UHF & Gậy trekking Carbon</h4>
            <p className="text-red-600 text-xs mt-1">Số lượng khả dụng chỉ còn phục vụ tối đa 2 đoàn trekking cuối tuần này. Yêu cầu thu hồi từ đoàn về hoặc nhập khẩn.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded text-xs font-bold hover:bg-red-50">Xem danh sách thiếu</button>
          <button className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700">Đặt hàng khẩn</button>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            <span>Quản trị hệ thống</span>
            <span className="mx-2">&gt;</span>
            <span>Hậu cần & Vật tư</span>
            <span className="mx-2">&gt;</span>
            <span className="font-medium text-gray-900">Tổng quan Kho vật tư</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Kho Vật tư & Thiết bị Dã ngoại</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full uppercase">V4.6 LIVE</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Điều phối tồn kho, theo dõi đơn chuẩn bị cho các đoàn trekking, kiểm định thiết bị hoàn trả và ghi nhận hư hại theo thời gian thực.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất báo cáo (Excel/PDF)
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
            Kiểm kê tức thì (Audit Scan)
          </button>
          <button className="px-4 py-2 bg-[#1B5E41] text-white rounded-lg text-sm font-bold hover:bg-[#144a33] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nhập kho thiết bị mới
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Tổng thiết bị kho</span>
            <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-gray-900">1.420</span>
            <span className="text-xs text-gray-500">món</span>
          </div>
          <div className="flex gap-2">
             <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded">100% tài sản</span>
             <span className="text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">~1.85 tỷ ₫</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full -z-10"></div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Sẵn sàng cho thuê</span>
            <div className="w-6 h-6 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-emerald-600">985</span>
            <span className="text-xs text-gray-500">món (69.4%)</span>
          </div>
          <div className="flex gap-2">
             <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-100">Khả dụng</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Đang xuất / Đi tour</span>
            <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-blue-600">320</span>
            <span className="text-xs text-gray-500">món (22.5%)</span>
          </div>
          <div className="text-[10px] text-gray-500 font-medium">Phục vụ 25 đoàn thực địa</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-orange-200 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Đang bảo trì / Kiểm định</span>
            <div className="w-6 h-6 rounded bg-orange-100 text-orange-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-orange-600">78</span>
            <span className="text-xs text-gray-500">món (5.5%)</span>
          </div>
          <div className="text-[10px] text-gray-500 font-medium">12 sửa chữa • 66 phân loại...</div>
        </div>

        <div className="bg-red-50 p-5 rounded-xl border border-red-200 shadow-sm relative overflow-hidden">
           <div className="absolute top-0 right-0 w-16 h-16 bg-red-100 rounded-bl-full -z-10"></div>
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-red-700 uppercase">Cảnh báo sắp hết</span>
            <div className="w-6 h-6 rounded bg-red-100 text-red-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-red-600">37</span>
            <span className="text-xs text-red-500">món (2.6%)</span>
          </div>
          <div className="flex gap-2">
             <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded">Cần bổ sung</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="col-span-8 space-y-6">
          {/* Inventory List */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Danh mục Thiết bị & Tỷ lệ Tồn kho</h3>
                <p className="text-xs text-gray-500">Giám sát số lượng khả dụng so với tổng tải đăng ký cung tour</p>
              </div>
              <div className="relative">
                <input type="text" placeholder="Lọc mã SKU, tên..." className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            </div>

            <div className="p-4 border-b border-gray-100 flex gap-2">
              <button className="px-3 py-1.5 bg-[#1B5E41] text-white text-xs font-bold rounded-full">Tất cả danh mục (8)</button>
              <button className="px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 text-xs font-semibold rounded-full hover:bg-gray-100">Chỗ ngủ & Lều trại</button>
              <button className="px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 text-xs font-semibold rounded-full hover:bg-gray-100">Leo núi & Dây đai</button>
              <button className="px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 text-xs font-semibold rounded-full hover:bg-gray-100">Thiết bị điện tử & Định vị</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="p-4 w-1/2">Thiết bị & SKU</th>
                    <th className="p-4 text-center">Tổng</th>
                    <th className="p-4 text-center text-emerald-600">Khả dụng</th>
                    <th className="p-4 text-center text-blue-600">Đi tour</th>
                    <th className="p-4 text-center text-orange-600">Bảo trì</th>
                    <th className="p-4">Tỷ lệ Sẵn sàng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventoryItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 flex gap-3 items-center">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl shadow-sm border border-gray-200">{item.icon}</div>
                        <div>
                          <div className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            {item.name}
                            {item.status === 'warning' && <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Thiếu</span>}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded border border-gray-200">{item.id}</span>
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            {item.brand}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-gray-900">{item.total}</td>
                      <td className={`p-4 text-center font-bold ${item.status === 'warning' ? 'text-red-600' : 'text-emerald-600'}`}>{item.available}</td>
                      <td className="p-4 text-center font-medium text-gray-600">{item.tour}</td>
                      <td className="p-4 text-center font-medium text-gray-600">{item.maintenance}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${item.status === 'warning' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {Math.round((item.available / item.total) * 100)}%
                          </span>
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                            <div className={`h-1.5 rounded-full ${item.status === 'warning' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${(item.available / item.total) * 100}%` }}></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 text-center">
              <button className="text-sm font-bold text-[#1B5E41] hover:underline flex items-center gap-1 mx-auto">
                Xem toàn bộ 48 phân loại con <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          {/* Damaged Equipment */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
             <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 </div>
                 <div>
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">Thiết bị Hư hỏng & Chờ Thẩm định <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">18 thiết bị cần xử lý</span></h3>
                    <p className="text-xs text-gray-500 mt-0.5">Ghi nhận biên bản từ Leader đoàn, mức phạt cọc hoàn trả và tiền đền bù khắc phục</p>
                 </div>
              </div>
              <button className="text-sm font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1">Xem lịch sử đền bù <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>
            
            <div className="p-5 space-y-4">
               {/* Item 1 */}
               <div className="border border-gray-200 rounded-lg p-4 flex gap-4 items-start relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                  <img src="https://images.unsplash.com/photo-1504280390224-dd25b3e6e810?q=80&w=150&auto=format&fit=crop" className="w-16 h-16 rounded object-cover shadow-sm border border-gray-200" alt="Tent" />
                  <div className="flex-1">
                     <div className="text-[10px] font-bold text-gray-500 mb-0.5">#EQ-TN-042</div>
                     <h4 className="font-bold text-gray-900 text-sm mb-1">Lều Naturehike Cloud Up 2P</h4>
                     <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded mb-2 inline-block">Chờ duyệt khấu trừ</span>
                     <div className="text-xs text-gray-600 space-y-1">
                        <div><span className="font-semibold">Đoàn:</span> Tà Xùa 3N2Đ (#TRIP-TX-88)</div>
                        <div><span className="font-semibold">Leader:</span> Hoàng Thu Trang</div>
                        <div className="text-red-600"><span className="font-semibold">Lỗi:</span> Rách vải lều 15cm do gió bão + cong 1 cọc nhôm</div>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Dự kiến khấu trừ</div>
                     <div className="text-xl font-bold text-red-600 mb-2">350.000 ₫</div>
                     <div className="flex gap-2">
                        <button className="px-3 py-1.5 bg-[#1B5E41] text-white text-xs font-bold rounded">Xử lý đền bù</button>
                        <button className="px-2 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded hover:bg-gray-200"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                     </div>
                  </div>
               </div>

               {/* Item 2 */}
               <div className="border border-gray-200 rounded-lg p-4 flex gap-4 items-start relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                  <img src="https://images.unsplash.com/photo-1584988770281-b58607153b69?q=80&w=150&auto=format&fit=crop" className="w-16 h-16 rounded object-cover shadow-sm border border-gray-200" alt="Radio" />
                  <div className="flex-1">
                     <div className="text-[10px] font-bold text-gray-500 mb-0.5">#EQ-BD-109</div>
                     <h4 className="font-bold text-gray-900 text-sm mb-1">Bộ đàm Motorola T82 #04</h4>
                     <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded mb-2 inline-block border border-gray-200">Gửi bảo hành hãng</span>
                     <div className="text-xs text-gray-600 space-y-1">
                        <div><span className="font-semibold">Đoàn:</span> Lảo Thẩn (#TRIP-LT-21)</div>
                        <div><span className="font-semibold">Trekker:</span> Lê Anh Tuấn</div>
                        <div className="text-amber-600"><span className="font-semibold">Lỗi:</span> Rơi suối ngấm nước sâu, chập mạch thu phát âm thanh</div>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Phí sửa thay màng</div>
                     <div className="text-xl font-bold text-amber-600 mb-2">650.000 ₫</div>
                     <button className="px-4 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded border border-blue-200">Biên bản bàn giao</button>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-4 space-y-6">
          {/* Orders Today */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-base">Đơn Xuất & Hoàn trả Hôm nay</h3>
                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">24/10/2024</span>
             </div>
             <div className="p-2 border-b border-gray-100 flex gap-1">
                <button className="flex-1 py-1.5 bg-gray-100 text-gray-800 text-xs font-bold rounded">Đang soạn đồ (4)</button>
                <button className="flex-1 py-1.5 text-gray-500 hover:bg-gray-50 text-xs font-medium rounded">Chờ nhận trả (3)</button>
             </div>
             
             <div className="p-4 space-y-4">
                {/* Order 1 */}
                <div className="border border-orange-200 bg-orange-50/50 rounded-lg p-3 relative overflow-hidden">
                   <div className="flex justify-between items-start mb-1">
                      <div className="text-[10px] font-black text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">#ORD-RENT-8021</div>
                      <span className="bg-orange-100 text-orange-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-orange-200">Xuất phát 20:00 sáng mai</span>
                   </div>
                   <h4 className="font-bold text-gray-900 text-sm mb-1 mt-2">Đoàn Tà Xùa Mùa Mây</h4>
                   <div className="text-[11px] text-gray-600 mb-2"><span className="font-semibold">Leader:</span> Phạm Minh Đức • 18 Trekker</div>
                   <div className="text-[11px] text-gray-800 font-medium mb-3 bg-white p-2 rounded border border-orange-100">
                      Gói vật tư: 8 Lều 2P, 18 Túi ngủ, 18 Gậy trekking, 4 Bộ đàm VHF.
                   </div>
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[10px] text-orange-700 font-semibold">
                         <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         Đang gói: 3/4 kiện
                      </div>
                      <button className="px-3 py-1 bg-[#1B5E41] text-white text-[10px] font-bold rounded shadow-sm">Kiểm kiện</button>
                   </div>
                </div>

                {/* Order 2 */}
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 relative overflow-hidden">
                   <div className="flex justify-between items-start mb-1">
                      <div className="text-[10px] font-black text-gray-900 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">#ORD-RENT-8018</div>
                      <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">Chuẩn bị xuất xe 21h</span>
                   </div>
                   <h4 className="font-bold text-gray-900 text-sm mb-1 mt-2">Đoàn Fansipan Trekking 2N1Đ</h4>
                   <div className="text-[11px] text-gray-600 mb-2"><span className="font-semibold">Leader:</span> Bùi Quang Huy • 12 Trekker</div>
                   <div className="text-[11px] text-gray-800 font-medium mb-3 bg-white p-2 rounded border border-emerald-100">
                      Gói vật tư: 12 Balo 50L, 12 Đèn đội đầu, 5 Dây cứu hộ 30m.
                   </div>
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold">
                         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                         Xong test pin & Khóa an toàn
                      </div>
                      <button className="px-3 py-1 bg-white border border-gray-200 text-gray-700 text-[10px] font-bold rounded shadow-sm">Chi tiết</button>
                   </div>
                </div>
             </div>
          </div>

          {/* Duty Roster */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-base">Ca trực Kho hôm nay</h3>
                <button className="text-xs text-[#1B5E41] font-semibold hover:underline">Đổi ca</button>
             </div>
             <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">NA</div>
                   <div className="flex-1">
                      <div className="font-bold text-sm text-gray-900 flex justify-between">Nguyễn Văn An <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded uppercase">Ca sáng</span></div>
                      <div className="text-[11px] text-gray-500">Quản lý Kho chính • Ext 102</div>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">TM</div>
                   <div className="flex-1">
                      <div className="font-bold text-sm text-gray-900 flex justify-between">Đặng Thị Mai <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded uppercase">Đang trực</span></div>
                      <div className="text-[11px] text-gray-500">Kỹ thuật & Khử trùng</div>
                   </div>
                </div>
             </div>
          </div>

          {/* Safety Standards */}
          <div className="bg-[#1B5E41] rounded-xl shadow-md p-5 text-white relative overflow-hidden">
             <div className="absolute -right-4 -top-4 opacity-10">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.642 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.358-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" /></svg>
             </div>
             <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-2">Quy chuẩn An toàn định kỳ</div>
             <h4 className="font-bold text-lg mb-2 leading-tight">Kiểm chuẩn Định kỳ Dây đai & Khóa Carabiner</h4>
             <p className="text-xs text-emerald-100/90 leading-relaxed mb-4">
                Kỳ kiểm định đợt Tháng 11/2024: Còn 5 ngày. Đã gửi 40 bộ dây cứu sinh và chốt neo chịu tải kiểm nghiệm tại Trung tâm Quatest 1.
             </p>
             <button className="text-xs font-bold text-white hover:text-emerald-200 flex items-center gap-1 transition-colors">
                Xem chứng thư <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
