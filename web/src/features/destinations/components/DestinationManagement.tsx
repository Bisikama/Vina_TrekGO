"use client";

import React, { useState } from 'react';

const destinationsData = [
  {
    id: 1,
    name: 'Tà Xùa (Sống Lưng Khủng Long)',
    region: 'TÂY BẮC • SƠN LA',
    altitude: '2.865m',
    status: 'Đang mở cửa',
    statusColor: 'bg-emerald-500',
    routes: 5,
    checkpoints: 12,
    season: 'Tháng 10 - Tháng 4 (Mùa mây & đồi chè cổ)',
    description: 'Địa hình sống núi hiểm trở dốc đứng tạo thành sống lưng hùng vĩ giữa biển mây...',
    gps: '100% On',
    image: 'https://images.unsplash.com/photo-1542640244-7e672d6cb468?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 2,
    name: 'Fansipan & Hoàng Liên Sơn',
    region: 'TÂY BẮC • LÀO CAI • LAI CHÂU',
    altitude: '3.143m',
    status: 'Đang mở cửa',
    statusColor: 'bg-emerald-500',
    routes: 8,
    checkpoints: 32,
    season: 'Tháng 9 - Tháng 4 (Mùa hoa đỗ quyên cổ)',
    description: 'Nóc nhà Đông Dương với hệ sinh thái rừng rêu ôn đới nguyên sinh, các tuyến Trạm...',
    gps: '3 Trạm trực',
    image: 'https://images.unsplash.com/photo-1596328659174-8b67104b2816?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 3,
    name: 'Kỳ Quan San (Bạch Mộc Lương Tử)',
    region: 'TÂY BẮC • LÀO CAI • LAI CHÂU',
    altitude: '3.046m',
    status: 'Đang mở cửa',
    statusColor: 'bg-emerald-500',
    routes: 4,
    checkpoints: 18,
    season: 'Tháng 11 - Tháng 4 (Mặt trời mọc đồi Muối)',
    description: 'Đỉnh núi cao thứ 4 Việt Nam sở hữu điểm ngắm bình minh đồi Muối ngoạn mục cu...',
    gps: '18/18 Online',
    image: 'https://images.unsplash.com/photo-1545657519-973e8964e16f?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 4,
    name: 'Đỉnh Lão Thẩn - Y Tý',
    region: 'TÂY BẮC • LÀO CAI',
    altitude: '2.860m',
    status: 'Đang mở cửa',
    statusColor: 'bg-emerald-500',
    routes: 3,
    checkpoints: 10,
    season: 'Tháng 9 - Tháng 3 (Hoàng hôn lộng gió)',
    description: 'Cung đường săn mây lý tưởng bậc nhất cho người mới bắt đầu (Beginner-friendl...',
    gps: '10/10 Sẵn sàng',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 5,
    name: 'Tà Năng - Phan Dũng',
    region: 'TÂY NGUYÊN • LÂM ĐỒNG • BÌNH THUẬN',
    altitude: '1.100m',
    status: 'Cảnh báo mùa mưa',
    statusColor: 'bg-amber-500',
    routes: 6,
    checkpoints: 24,
    season: 'Tháng 12 - Tháng 5 (Mùa cỏ xanh & cỏ cháy)',
    description: 'Tuyến trekking liên tỉnh vượt địa hình từ cao nguyên xuống duyên hải dài hơn...',
    gps: 'Khuyến cáo: Tránh lội suối',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=600&auto=format&fit=crop'
  },
  {
    id: 6,
    name: 'Núi Bà Đen (Đệ Nhất Thiên Sơn)',
    region: 'ĐÔNG NAM BỘ • TÂY NINH',
    altitude: '986m',
    status: 'Đang mở cửa',
    statusColor: 'bg-emerald-500',
    routes: 5,
    checkpoints: 14,
    season: 'Quanh năm (Trừ các đợt mưa bão lớn)',
    description: 'Đỉnh núi cao nhất Đông Nam Bộ với nhiều tuyến đa dạng: Đường Cột Điện, Đường...',
    gps: 'Hoạt động tốt',
    image: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?q=80&w=600&auto=format&fit=crop'
  }
];

export const DestinationManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            <span>Quản trị hệ thống</span>
            <span className="mx-2">&gt;</span>
            <span className="font-medium text-gray-900">Điểm đến & Vùng núi</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Điểm đến & Vùng núi</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              18 Điểm đến toàn quốc
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Quản lý các cụm núi, dãy địa hình tự nhiên, cấp quyền khai thác và giám sát các cung đường trekking trực thuộc.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất dữ liệu
          </button>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button className="px-3 py-1.5 bg-white shadow-sm rounded text-sm font-medium text-gray-800">Dạng thẻ</button>
            <button className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">Dạng bảng</button>
          </div>
          <button className="px-4 py-2 bg-[#1B5E41] text-white rounded-lg text-sm font-medium hover:bg-[#144a33] flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Thêm điểm đến mới
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-gray-500">Tổng số điểm đến</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">18</span>
            <span className="text-sm text-gray-500">vùng núi trong điểm</span>
          </div>
          <div className="flex gap-2 mt-4 text-xs font-medium">
            <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">16 Hoạt động</span>
            <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md">2 Tạm đóng</span>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-gray-500">Cung đường kết nối</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">48</span>
            <span className="text-sm text-gray-500">tuyến trekking</span>
          </div>
          <div className="flex justify-between mt-4 text-xs">
            <span className="text-gray-500">Trung bình: <span className="font-medium text-gray-900">2.7 cung/vùng</span></span>
            <span className="text-emerald-600 font-medium flex items-center"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> 3 tuyến mới</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-gray-500">Điểm checkpoints</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">216</span>
            <span className="text-sm text-gray-500">trạm vệ tinh GPS</span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1 font-medium">
               <span>Hoạt động</span>
               <span className="text-emerald-600">96% Sẵn sàng</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '96%' }}></div>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-sm font-medium text-gray-500">Lượng Trekker tháng này</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">4.820</span>
            <span className="text-sm text-gray-500">lượt khám phá</span>
          </div>
          <div className="mt-4 text-xs font-medium text-emerald-600 flex items-center bg-emerald-50 w-max px-2 py-1 rounded">
             <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             Tỷ lệ an toàn tuyệt đối @ 99.8%
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Tìm theo điểm đến..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select className="border border-gray-200 rounded-lg text-sm py-2 px-3 text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option>Tất cả vùng miền</option>
          <option>Tây Bắc</option>
          <option>Tây Nguyên</option>
          <option>Đông Nam Bộ</option>
        </select>
        <select className="border border-gray-200 rounded-lg text-sm py-2 px-3 text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option>Tất cả trạng thái</option>
          <option>Đang mở cửa</option>
          <option>Tạm đóng</option>
          <option>Cảnh báo</option>
        </select>
        <select className="border border-gray-200 rounded-lg text-sm py-2 px-3 text-gray-700 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option>Nhiều cung đường nhất</option>
          <option>Ít cung đường nhất</option>
          <option>Độ cao giảm dần</option>
        </select>
        <button className="px-3 py-2 bg-gray-50 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-5">
        {destinationsData.map((dest) => (
          <div key={dest.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all group">
            <div className="relative h-48">
              <img src={dest.image} alt={dest.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              
              <div className="absolute top-3 left-3">
                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white rounded-full flex items-center gap-1.5 backdrop-blur-md ${dest.statusColor}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                  {dest.status}
                </span>
              </div>
              
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-gray-700 hover:text-emerald-600 hover:bg-white shadow-sm transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 shadow-sm transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>

              <div className="absolute bottom-3 left-4 right-4 text-white">
                <div className="text-[10px] font-bold tracking-widest text-emerald-300 mb-1">{dest.region}</div>
                <div className="flex justify-between items-end">
                  <h3 className="text-lg font-bold leading-tight max-w-[70%]">{dest.name}</h3>
                  <div className="flex items-center text-sm font-semibold bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
                    <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    {dest.altitude}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex divide-x divide-gray-100 text-sm mb-4">
                <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                  <div className="font-bold text-gray-900">{dest.routes}</div>
                  <div className="text-xs text-gray-500">cung đường</div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                  <div className="font-bold text-gray-900">trực thuộc</div>
                  <div className="text-xs text-gray-500">-</div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
                  <div className="font-bold text-gray-900">{dest.checkpoints}</div>
                  <div className="text-xs text-gray-500">checkpoints</div>
                </div>
              </div>

              <div className="bg-orange-50/50 rounded-lg p-3 text-xs flex gap-2.5 mb-3 border border-orange-100/50">
                <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <div className="text-gray-600">
                  <span className="font-medium text-gray-800">Mùa lý tưởng:</span> {dest.season}
                </div>
              </div>

              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4">
                {dest.description}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center text-xs text-gray-500 gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                  <span>Trạm GPS: <span className="font-medium text-gray-900">{dest.gps}</span></span>
                </div>
                <button className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-800 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors">
                  Xem {dest.routes} cung đường
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
