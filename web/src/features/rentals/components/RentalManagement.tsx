"use client";

import React, { useState } from 'react';

const rentalProducts = [
  {
    id: 1,
    name: 'Lều siêu nhẹ Cloud Up 2 Pro',
    brand: 'Naturehike',
    sku: 'NH-CU2P-GRN',
    category: 'Lều cắm trại',
    image: 'https://images.unsplash.com/photo-1504280390224-dd25b3e6e810?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: 2,
    name: 'Túi ngủ lông vũ CWB200',
    brand: 'Naturehike',
    sku: 'NH-SB-CWB2',
    category: 'Túi ngủ & Nệm',
    image: 'https://images.unsplash.com/photo-1596204558097-f57ef59b8be5?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: 3,
    name: 'Gậy leo núi Trail Pro Shock',
    brand: 'Black Diamond',
    sku: 'BD-POLE-CRB',
    category: 'Gậy & Leo núi',
    image: 'https://plus.unsplash.com/premium_photo-1664300305886-f187383a8b27?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: 4,
    name: 'Balo trợ lực Atmos AG 65L',
    brand: 'Osprey',
    sku: 'OSP-ATM-65',
    category: 'Balo dã ngoại',
    image: 'https://images.unsplash.com/photo-1622260614153-03223fb72052?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: 5,
    name: 'Đèn pin đội đầu Storm 450 Lumen',
    brand: 'Black Diamond',
    sku: 'BD-HL-ST45',
    category: 'Thiết bị điện tử',
    image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=150&auto=format&fit=crop'
  },
  {
    id: 6,
    name: 'Bộ đàm chống va đập T82 Extreme',
    brand: 'Motorola',
    sku: 'MOT-T82-PAIR',
    category: 'Thiết bị điện tử',
    image: 'https://images.unsplash.com/photo-1584988770281-b58607153b69?q=80&w=150&auto=format&fit=crop'
  }
];

export const RentalManagement = () => {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            <span>Quản trị hệ thống</span>
            <span className="mx-2">&gt;</span>
            <span>Hậu cần & Vật tư</span>
            <span className="mx-2">&gt;</span>
            <span className="font-medium text-gray-900">Thiết bị cho thuê</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Thiết bị Cho thuê (Rental Products)</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full uppercase">KHO HOẠT ĐỘNG</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Thiết lập danh mục sản phẩm dã ngoại, đơn giá thuê theo ngày, tiền cọc bảo đảm, quản lý size và tình trạng sẵn sàng xuất kho cho trekker toàn quốc.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất bảng giá (Excel/PDF)
          </button>
          <button className="px-4 py-2 bg-[#1B5E41] text-white rounded-lg text-sm font-bold hover:bg-[#144a33] flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Thêm sản phẩm mới
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Tổng sản phẩm niêm yết</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-gray-900">32</span>
            <span className="text-sm font-semibold text-gray-500">mã sản phẩm</span>
          </div>
          <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
             <span className="text-[11px] text-gray-600 font-medium">94 biến thể kích cỡ</span>
             <span className="text-emerald-600 font-bold text-xs flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> +4 mới</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Đang mở cho thuê</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-emerald-600">28</span>
            <span className="text-sm font-semibold text-gray-500">mặt hàng Active</span>
          </div>
          <div className="mt-auto">
             <div className="w-full h-1.5 bg-gray-200 rounded-full mb-1">
                <div className="h-1.5 bg-emerald-500 rounded-full" style={{ width: '87.5%' }}></div>
             </div>
             <div className="text-[10px] font-bold text-gray-500 text-right">87.5%</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Giá thuê bình quân</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-black text-gray-900">85.000₫</span>
            <span className="text-sm font-semibold text-gray-500">/ ngày</span>
          </div>
          <div className="text-[11px] font-medium text-gray-600 flex items-center gap-1.5">
             <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
             Tỷ lệ hoàn cọc chuẩn: <strong className="text-gray-900">98.2%</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
           <div className="absolute top-0 right-0 p-2"><svg className="w-16 h-16 text-orange-50 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" /></svg></div>
          <div className="flex justify-between items-start mb-2 relative z-10">
            <span className="text-xs font-bold text-gray-500 uppercase">Nhu cầu cao điểm</span>
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900 mb-2 relative z-10">Lều 2P & Gậy...</div>
          <div className="flex gap-3 text-xs font-bold relative z-10">
             <span className="text-orange-600 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div> Cuối tuần lấp đầy</span>
             <span className="text-gray-600">95% công suất</span>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Product List */}
        <div className="col-span-8">
           {/* Filters */}
          <div className="flex gap-3 mb-4 items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
                placeholder="Tìm kiếm theo tên thiết bị, mã SKU, thương hiệu..."
              />
            </div>
            <select className="border border-gray-200 rounded-lg text-sm py-2 px-3 text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[160px]">
              <option>Tất cả danh mục (5)</option>
            </select>
            <select className="border border-gray-200 rounded-lg text-sm py-2 px-3 text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[160px]">
              <option>Tất cả trạng thái</option>
            </select>
            <div className="flex items-center gap-2 text-sm text-gray-600 ml-2">
               Sắp xếp: 
               <button className="flex items-center gap-1 border-b border-dashed border-gray-400 font-semibold text-gray-800">
                  Mới cập nhật nhất <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               </button>
            </div>
            <div className="flex gap-1 ml-auto">
               <button className="w-8 h-8 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg></button>
               <button className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                   <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                   <span className="font-bold text-sm text-gray-700">Danh sách thiết bị (6 hiển thị / 32 tổng cộng)</span>
                </label>
                <button className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-gray-50">
                   <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> Cột hiển thị
                </button>
             </div>
             
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-blue-50/30 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="p-4 pl-11">Sản phẩm & Mã SKU</th>
                      <th className="p-4 text-right pr-6">Danh mục</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {rentalProducts.map((prod) => (
                      <tr key={prod.id} className="hover:bg-gray-50/50 transition-colors">
                         <td className="p-4 pl-4 flex items-center gap-4">
                            <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                            <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm shrink-0">
                               <img src={prod.image} alt={prod.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                               <div className="font-bold text-gray-900 text-[15px] mb-1">{prod.name}</div>
                               <div className="flex items-center gap-2">
                                  <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200">{prod.brand}</span>
                                  <span className="text-[11px] text-gray-500">SKU: <span className="font-mono text-gray-600">{prod.sku}</span></span>
                               </div>
                            </div>
                         </td>
                         <td className="p-4 text-right pr-6">
                            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 inline-block">{prod.category}</span>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
             
             <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-b-xl">
               <div className="text-xs text-gray-500">
                 Hiển thị <span className="font-bold text-gray-900">1-6</span> trên tổng số <span className="font-bold text-gray-900">32</span> thiết bị
               </div>
               <div className="flex gap-1">
                 <button className="px-3 py-1.5 bg-white border border-gray-200 text-gray-400 text-xs font-semibold rounded cursor-not-allowed">Trước</button>
                 <button className="w-8 h-8 rounded bg-[#1B5E41] text-white text-xs font-bold flex items-center justify-center">1</button>
                 <button className="w-8 h-8 rounded bg-white border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 flex items-center justify-center">2</button>
                 <button className="w-8 h-8 rounded bg-white border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 flex items-center justify-center">3</button>
                 <button className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded hover:bg-gray-50">Tiếp theo</button>
               </div>
             </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-4 mt-6">
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 border-2 border-emerald-100 shadow-sm text-emerald-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
             </div>
             <div>
                <h4 className="font-bold text-gray-900 mb-1">Chính sách bảo chứng thiết bị (Mountain Leader Guarantee)</h4>
                <p className="text-sm text-gray-700 leading-relaxed">Trekker tham gia tour có Mountain Leader được miễn giảm 100% tiền đặt cọc thiết bị lều trại và gậy leo núi. Hệ thống tự động gán cờ tài khoản đảm bảo qua ID Leader phụ trách đoàn.</p>
             </div>
          </div>
        </div>

        {/* Create/Edit Form */}
        <div className="col-span-4">
           <div className="bg-white border border-gray-200 rounded-xl shadow-lg sticky top-24">
              <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1B5E41] rounded-lg flex items-center justify-center text-white shadow-sm">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                       <h3 className="font-bold text-gray-900 text-lg">Thêm sản phẩm cho thuê mới</h3>
                       <p className="text-[11px] text-gray-500">Nhập thông số thiết bị, đơn giá và quy chuẩn kiểm định</p>
                    </div>
                 </div>
                 <div className="flex flex-col items-end gap-2">
                    <button className="text-gray-400 hover:text-gray-600">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider text-center">TẠO MỚI<br/>SKU</span>
                 </div>
              </div>

              <div className="p-5 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                 <div>
                    <div className="flex justify-between items-center mb-1">
                       <label className="text-xs font-bold text-gray-700">Tên sản phẩm thiết bị <span className="text-red-500">*</span></label>
                       <span className="text-[10px] text-gray-400">Tối đa 80 ký tự</span>
                    </div>
                    <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500" placeholder="Lều cắm trại Naturehike Cloud Up 2 Silicon" defaultValue="Lều cắm trại Naturehike Cloud Up 2 Silicon" />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-xs font-bold text-gray-700 mb-1">Danh mục thiết bị <span className="text-red-500">*</span></label>
                       <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                          <option>Lều trại & Chỗ ngủ</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-gray-700 mb-1">Thương hiệu & Model <span className="text-red-500">*</span></label>
                       <input type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500" defaultValue="Naturehike - Cloud U..." />
                    </div>
                 </div>

                 <div>
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold text-gray-700">Kích cỡ / Bản biến thể khả dụng</label>
                       <button className="text-[10px] font-bold text-[#1B5E41] hover:underline flex items-center gap-0.5">+ Thêm biến thể</button>
                    </div>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                       <span className="bg-[#1B5E41] text-white text-xs font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                          2 Người (Bản 20D)
                          <button className="hover:text-gray-200"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                       </span>
                       <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 border border-gray-300">
                          3 Người (Bản 210T)
                          <button className="hover:text-gray-500"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                       </span>
                       <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1.5 rounded-full flex items-center gap-1.5 border border-gray-300">
                          Size M / L
                          <button className="hover:text-gray-500"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                       </span>
                       <input type="text" placeholder="+ Nhập size..." className="bg-transparent text-xs w-24 focus:outline-none text-gray-500 placeholder-gray-400" />
                    </div>
                 </div>

                 <div className="border border-emerald-100 bg-emerald-50/30 rounded-xl p-4">
                    <h4 className="font-bold text-sm text-emerald-900 flex items-center gap-2 mb-3">
                       <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Chính sách giá thuê & Đặt cọc bảo đảm
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                       <div>
                          <label className="block text-[10px] font-bold text-gray-600 mb-1">Giá thuê 1 ngày (VNĐ) <span className="text-red-500">*</span></label>
                          <div className="relative">
                             <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right pr-12" defaultValue="120.000" />
                             <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">đ/ngày</span>
                          </div>
                       </div>
                       <div>
                          <label className="block text-[10px] font-bold text-gray-600 mb-1">Tiền đặt cọc chuẩn (VNĐ) <span className="text-red-500">*</span></label>
                          <div className="relative">
                             <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-right pr-12" defaultValue="1.200.000" />
                             <span className="absolute right-3 top-2.5 text-xs text-gray-400 font-medium">đ/mục</span>
                          </div>
                       </div>
                    </div>

                    <div className="flex justify-between items-start mb-3">
                       <div>
                          <div className="font-bold text-xs text-gray-900">Giảm giá thuê dài ngày (Từ ngày thứ 3)</div>
                          <div className="text-[10px] text-gray-500">Tự động chiết khấu 20% kể từ ngày thứ 3 trong lịch trình</div>
                       </div>
                       <div className="w-8 h-4 bg-emerald-500 rounded-full relative cursor-pointer shrink-0 mt-1">
                          <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5"></div>
                       </div>
                    </div>

                    <div className="bg-emerald-50 rounded p-2.5 flex items-start gap-2 border border-emerald-100">
                       <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                       <div className="text-[10px] text-emerald-800 leading-tight">
                          Áp dụng <strong>Miễn 100% tiền cọc</strong> đối với Trekker đi cùng Mountain Leader có chứng chỉ nghiệp vụ.
                       </div>
                    </div>
                 </div>

                 <div>
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold text-gray-700">Hình ảnh thiết bị thực địa (Tối đa 6 ảnh)</label>
                       <span className="text-[10px] font-medium text-gray-400">Đã tải 3/6 ảnh</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                       <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img src="https://images.unsplash.com/photo-1504280390224-dd25b3e6e810?q=80&w=150&auto=format&fit=crop" className="w-full h-full object-cover" alt="Image 1" />
                       </div>
                       <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <img src="https://images.unsplash.com/photo-1533580556209-66c8fb73d191?q=80&w=150&auto=format&fit=crop" className="w-full h-full object-cover" alt="Image 2" />
                       </div>
                       <div className="aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-emerald-600 transition-colors cursor-pointer">
                          <svg className="w-6 h-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                          <span className="text-[9px] font-bold">Thêm ảnh</span>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2 rounded-b-xl">
                 <button className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg shadow-sm hover:bg-gray-50 transition-colors">Hủy bỏ / Đóng</button>
                 <button className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg shadow-sm hover:bg-gray-50 transition-colors">Lưu bản nháp</button>
                 <button className="flex-[1.5] py-2.5 bg-[#1B5E41] hover:bg-[#144a33] text-white text-sm font-bold rounded-lg shadow-md transition-colors flex items-center justify-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    Lưu & Công khai
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
