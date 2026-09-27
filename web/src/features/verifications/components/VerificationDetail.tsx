"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export const VerificationDetail = () => {
  const [checklist, setChecklist] = useState({
    item1: true,
    item2: false,
    item3: true,
    item4: true
  });

  const toggleChecklist = (item: string) => {
    setChecklist({ ...checklist, [item]: !checklist[item as keyof typeof checklist] });
  };

  return (
    <div className="p-6 bg-gray-50/50 min-h-screen">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2 uppercase">
            <Link href="/admin" className="hover:text-gray-900 transition-colors">Quản trị hệ thống</Link>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <Link href="/admin/verifications" className="hover:text-gray-900 transition-colors">Thẩm định dữ liệu</Link>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <Link href="/admin/verifications" className="hover:text-gray-900 transition-colors">Hàng đợi thẩm định</Link>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-900">Hồ sơ #VER-2024-089</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin/verifications" className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 shadow-sm transition-colors">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Thẩm định Cung đường: Hố Thầu - Tả Củ Tỷ (Hoàng Su Phì, Hà Giang)</h1>
          </div>
          <div className="flex items-center gap-3 mt-3">
             <span className="bg-gray-200 text-gray-700 text-xs font-bold px-3 py-1 rounded-full border border-gray-300">#VER-2024-089</span>
             <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                Đang chờ thẩm định
             </span>
             <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-200 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Quá hạn SLA 4 ngày 8 giờ (Cần xử lý khẩn cấp!)
             </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất biên bản (PDF)
          </button>
          <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Tải GPX gốc
          </button>
          <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Liên hệ người nộp
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         {/* Cột trái: Thông tin & Checkpoints */}
         <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
               <div className="flex gap-6 mb-6">
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-2xl shrink-0 border-4 border-white shadow-sm">VT</div>
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-bold text-xl text-gray-900">Vũ Trí</h2>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">Trekker Cấp 3 (#TK-8819)</span>
                     </div>
                     <p className="text-xs text-gray-500 mb-3">Đã hoàn thành 14 chuyến đi khảo sát độc lập</p>
                     <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-medium text-gray-600">
                        <div className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> 0988 231 xxx</div>
                        <div className="flex items-center gap-1.5"><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> vutri.tenteco@gmail.com</div>
                        <div className="flex items-center gap-1.5 col-span-2"><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Nộp: 20/10/2024 08:30</div>
                     </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-5 gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                     <div className="flex justify-center mb-1"><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
                     <div className="text-[9px] font-bold text-gray-500 mb-0.5">CỰ LY</div>
                     <div className="text-sm font-black text-gray-900">38.5 km</div>
                     <div className="text-[9px] text-gray-500">Đo thực tế GPX</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                     <div className="flex justify-center mb-1"><svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg></div>
                     <div className="text-[9px] font-bold text-gray-500 mb-0.5">ĐỘ DỐC (+GAIN)</div>
                     <div className="text-sm font-black text-emerald-600">+2.400 m</div>
                     <div className="text-[9px] text-gray-500">Loss: 2.150m</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                     <div className="flex justify-center mb-1"><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg></div>
                     <div className="text-[9px] font-bold text-gray-500 mb-0.5">CAO ĐỘ MAX</div>
                     <div className="text-sm font-black text-gray-900">2.420 m</div>
                     <div className="text-[9px] text-gray-500">Đỉnh Tả Củ Tỷ</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
                     <div className="flex justify-center mb-1"><svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                     <div className="text-[9px] font-bold text-gray-500 mb-0.5">DỰ KIẾN</div>
                     <div className="text-sm font-black text-gray-900">3N 2Đ</div>
                     <div className="text-[9px] text-gray-500">Nhịp độ di chuyển trung bình</div>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                     <div className="flex justify-center mb-1"><svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                     <div className="text-[9px] font-bold text-red-600 mb-0.5">ĐỘ KHÓ</div>
                     <div className="text-sm font-black text-red-700">Cấp 5</div>
                     <div className="text-[9px] text-red-600">Thám hiểm sinh tồn</div>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden relative">
               <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  Bản Đồ Kiểm Tra Tuyến Tracklog
                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">WGS84 System</span>
               </h3>
               
               <div className="h-[300px] bg-emerald-50 rounded-xl border border-emerald-100 relative mb-6 overflow-hidden flex items-center justify-center">
                  <div className="absolute top-3 left-3 flex gap-1 z-10">
                     <button className="bg-white border border-gray-200 text-gray-700 text-[10px] font-bold px-3 py-1.5 rounded shadow-sm hover:bg-gray-50">Vệ tinh</button>
                     <button className="bg-[#1B5E41] text-white text-[10px] font-bold px-3 py-1.5 rounded shadow-sm">Địa hình (Topo)</button>
                     <button className="bg-white border border-gray-200 text-gray-700 text-[10px] font-bold px-3 py-1.5 rounded shadow-sm hover:bg-gray-50">Nhiệt độ</button>
                     <button className="bg-white border border-gray-200 text-gray-700 text-[10px] font-bold px-3 py-1.5 rounded shadow-sm hover:bg-gray-50">Mưa / Bão Sơn</button>
                  </div>
                  <div className="absolute right-3 top-3 flex flex-col gap-1 z-10">
                     <button className="w-8 h-8 bg-white border border-gray-200 text-gray-700 rounded shadow-sm flex items-center justify-center font-bold">+</button>
                     <button className="w-8 h-8 bg-white border border-gray-200 text-gray-700 rounded shadow-sm flex items-center justify-center font-bold">-</button>
                     <button className="w-8 h-8 bg-white border border-gray-200 text-gray-700 rounded shadow-sm flex items-center justify-center mt-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                     </button>
                  </div>
                  
                  {/* Mock Map Image background */}
                  <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=600&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-30" alt="" />
                  
                  {/* Mock Route Line */}
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                     <path d="M 10 80 Q 25 70, 40 50 T 60 20 T 90 30" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" className="drop-shadow-md" />
                     <path d="M 10 80 Q 25 70, 40 50" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 1" className="drop-shadow-md animate-pulse" />
                     
                     <circle cx="10" cy="80" r="1.5" fill="#10B981" />
                     <circle cx="40" cy="50" r="1.5" fill="#EF4444" />
                     <circle cx="90" cy="30" r="1.5" fill="#10B981" />
                  </svg>
                  
                  {/* Warning Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur border border-red-200 rounded-xl p-3 flex justify-between items-center shadow-lg">
                     <div className="flex gap-3 items-center">
                        <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div>
                           <div className="text-sm font-bold text-red-800">Cảnh báo tiêu chuẩn an toàn cung đường (Rule V-ST)</div>
                           <div className="text-xs text-red-600">Khoảng cách giữa CP2 (Km 16.2) và CP3 (Km 30.5) là 14.3km, vượt quy định tối đa 10km không có trạm nghỉ / nước.</div>
                        </div>
                     </div>
                     <button className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors">Đánh dấu vị trí</button>
                  </div>
               </div>
               
               {/* Elevation Profile Mock */}
               <div>
                  <h4 className="text-xs font-bold text-gray-900 flex items-center gap-2 mb-3">
                     <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                     Biểu Đồ Mặt Cắt Cao Độ (Elevation Profile)
                     <span className="font-normal text-gray-500 ml-auto">Min: 650m | Max: 2.420m | Trung bình: 1.645m</span>
                  </h4>
                  <div className="h-32 bg-gray-50 border border-gray-100 rounded-lg relative overflow-hidden flex items-end">
                     {/* SVG graph mock */}
                     <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <defs>
                           <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" style={{stopColor: '#10B981', stopOpacity: 0.2}} />
                              <stop offset="100%" style={{stopColor: '#10B981', stopOpacity: 0}} />
                           </linearGradient>
                        </defs>
                        <path d="M 0 100 L 0 80 Q 20 80, 30 60 T 50 70 T 70 20 T 90 40 L 100 30 L 100 100 Z" fill="url(#grad1)" stroke="none" />
                        <path d="M 0 80 Q 20 80, 30 60 T 50 70 T 70 20 T 90 40 L 100 30" fill="none" stroke="#1B5E41" strokeWidth="1.5" />
                        
                        {/* Red segment indicating warning area */}
                        <path d="M 30 60 T 50 70 T 70 20" fill="none" stroke="#EF4444" strokeWidth="2.5" />
                     </svg>
                     
                     {/* Axis labels */}
                     <div className="absolute inset-0 flex justify-between px-2 pb-1 text-[9px] text-gray-400 font-medium">
                        <div className="self-end pb-1 border-l border-gray-300 pl-1 h-2 flex items-end">Km 0 (650m)</div>
                        <div className="self-end pb-1 border-l border-gray-300 pl-1 h-2 flex items-end">Km 8.4 (1.350m)</div>
                        <div className="self-end pb-1 border-l border-gray-300 pl-1 h-2 flex items-end text-red-500 font-bold bg-white/80 px-1 rounded">Km 24.0 (Thiếu SOS)</div>
                        <div className="self-end pb-1 border-l border-gray-300 pl-1 h-2 flex items-end text-emerald-700 font-bold bg-white/80 px-1 rounded">Km 30.5 (2.420m)</div>
                        <div className="self-end pb-1 border-l border-gray-300 pl-1 h-2 flex items-end">Km 38.5 (820m)</div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                     <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                     Danh Sách 5 Trạm Dừng & Dữ Liệu Khảo Sát Thực Địa
                  </h3>
                  <span className="text-xs text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded">Tọa độ WGS84 chính xác</span>
               </div>

               <div className="space-y-4">
                  {/* Trạm 1 */}
                  <div className="bg-gray-50 rounded-xl p-4 flex gap-4">
                     <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">1</div>
                     <div className="flex-1">
                        <h4 className="font-bold text-gray-900 text-sm mb-1">Bản Luốc (Km 0.0) - Điểm Xuất Phát</h4>
                        <div className="text-xs text-gray-500 mb-2">22.7530° N, 104.5291° E • Cao độ 650m</div>
                        <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">Khu dân cư, gửi xe ô tô, có tạp hóa, trạm y tế xã Luốc.</p>
                        <div className="flex gap-2">
                           <span className="bg-white border border-gray-200 text-gray-600 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> 4G Viettel/Vina</span>
                           <span className="bg-white border border-gray-200 text-gray-600 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg> Nước sinh hoạt</span>
                        </div>
                     </div>
                  </div>

                  {/* Trạm error */}
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-4 relative">
                     <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0 z-10">!</div>
                     <div className="flex-1">
                        <div className="flex justify-between items-start">
                           <div>
                              <h4 className="font-bold text-red-900 text-sm mb-1">Lán Rừng Già Hạt Dẻ (Km 24.0)</h4>
                              <div className="text-xs text-red-700 mb-2">22.8243° N, 104.7313° E • Cao độ 1.895m</div>
                           </div>
                           <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded">Chưa đạt chuẩn SOS</span>
                        </div>
                        <p className="text-[11px] text-red-800 font-medium mb-3 bg-white/50 p-2 rounded">
                           Chỉ là lán thợ săn của người dân bản, mái dột nát, không có tủ thuốc hay hệ thống vệ sinh.
                        </p>
                        <div className="flex gap-2">
                           <span className="bg-white border border-red-200 text-red-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg> Vùng mù viễn thông</span>
                           <span className="bg-white border border-red-200 text-red-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Suối cạn mùa đông</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
            
            {/* Hình ảnh */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Hình Ảnh Thực Địa Nộp Kèm (4 Ảnh đi kèm)</h3>
                  <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded flex items-center gap-1">
                     <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                     100% Khớp Tọa độ EXIF
                  </span>
               </div>
               <div className="grid grid-cols-4 gap-3">
                  {[1,2,3,4].map(i => (
                     <div key={i} className="space-y-1">
                        <img src={`https://images.unsplash.com/photo-${1500000000000 + i * 10000000}?q=80&w=200&auto=format&fit=crop`} className="w-full h-24 object-cover rounded-lg bg-gray-100 border border-gray-200" alt="" />
                        <div className="text-[9px] text-gray-500 line-clamp-1 font-medium">GPS xác thực</div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Cột phải: Form Thẩm định & Checklist */}
         <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg border-2 border-emerald-500 p-1 sticky top-6">
               <div className="bg-white rounded-lg p-5">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="font-black text-gray-900 text-lg">Bảng Đối Soát & Thẩm Định</h3>
                     <div className="w-12 h-12 rounded-full border-4 border-emerald-100 flex items-center justify-center">
                        <span className="text-emerald-600 font-black text-sm">75%</span>
                     </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-4 pb-4 border-b border-gray-100">Tiêu chuẩn An toàn & Môi trường Trekking Quốc gia</p>

                  <div className="space-y-3 mb-6">
                     <div 
                        onClick={() => toggleChecklist('item1')}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checklist.item1 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}
                     >
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checklist.item1 ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
                           {checklist.item1 && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div>
                           <div className="text-sm font-bold text-gray-900 mb-0.5">1. Tuyến đường bộ & An toàn</div>
                           <p className="text-[10px] text-gray-600">Không cắt ngang vực sâu nguy cơ sạt lở, đi dọc theo luồng gió mạnh. Nằm trong vùng cho phép khai thác du lịch.</p>
                        </div>
                     </div>

                     <div 
                        onClick={() => toggleChecklist('item2')}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${!checklist.item2 ? 'bg-red-50/50 border-red-200 shadow-inner' : 'bg-emerald-50/50 border-emerald-200'}`}
                     >
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checklist.item2 ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-red-500 border-red-500 text-white'}`}>
                           {checklist.item2 ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>}
                        </div>
                        <div>
                           <div className="flex items-center justify-between mb-0.5">
                              <div className={`text-sm font-bold ${!checklist.item2 ? 'text-red-900' : 'text-gray-900'}`}>2. Mật độ trạm dừng dày đặc</div>
                              {!checklist.item2 && <span className="bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Cảnh báo</span>}
                           </div>
                           <p className={`text-[10px] ${!checklist.item2 ? 'text-red-700 font-medium' : 'text-gray-600'}`}>Đang thiếu 1 trạm nghỉ có nước/SOS giữa chặng 3. Có sự chênh lệch lớn về khoảng cách.</p>
                        </div>
                     </div>

                     <div 
                        onClick={() => toggleChecklist('item3')}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checklist.item3 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}
                     >
                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checklist.item3 ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}>
                           {checklist.item3 && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <div>
                           <div className="text-sm font-bold text-gray-900 mb-0.5">3. Không vi phạm khu vực cấm</div>
                           <p className="text-[10px] text-gray-600">Đã đối chiếu với bản đồ quy hoạch rừng quốc gia và các khu vực an ninh biên giới.</p>
                        </div>
                     </div>
                  </div>

                  <div className="mb-6">
                     <label className="block text-xs font-bold text-gray-900 mb-2">Đánh giá cấp độ khó theo dữ liệu</label>
                     <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg">Hệ thống đề xuất</div>
                        <h4 className="font-black text-emerald-800 text-sm mb-1">Cấp 5 - Thám hiểm sinh tồn</h4>
                        <p className="text-[10px] text-emerald-700 font-medium leading-relaxed">Dựa trên khoảng cách {'>'}35km, +2400m gain và thiếu hụt tiện ích ở một số khu vực. Bắt buộc phải có Leader PRO được cấp phép dẫn đường.</p>
                     </div>
                  </div>

                  <div className="mb-6">
                     <label className="block text-xs font-bold text-gray-900 mb-2">Ghi chú & Yêu cầu bổ sung cho Trekker</label>
                     <textarea 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors h-24"
                        placeholder="Nhập yêu cầu bổ sung thông tin hoặc lý do từ chối..."
                        defaultValue="Cung đường có cảnh quan đẹp và số liệu GPX chuẩn xác. Tuy nhiên, khoảng cách giữa CP2 (Km16) và CP3 (Km30.5) quá xa (14.5km) chưa có điểm cấp nước hoặc trạm dừng chân an toàn. Yêu cầu khảo sát và bổ sung thêm 1 trạm dừng giữa chặng này."
                     ></textarea>
                     <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input type="checkbox" defaultChecked className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                        <span className="text-xs font-medium text-gray-700">Gửi kèm thông báo SMS/Email tự động tới người nộp (Vũ Trí)</span>
                     </label>
                  </div>

                  <div className="flex gap-3">
                     <button className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-sm py-3 rounded-xl transition-colors">
                        Từ chối / Bổ sung
                     </button>
                     <button className="flex-1 bg-[#1B5E41] hover:bg-[#154B36] text-white font-bold text-sm py-3 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2" disabled={!checklist.item2}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Phê duyệt & Đóng dấu
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
