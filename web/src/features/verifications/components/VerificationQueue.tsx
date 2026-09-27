"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export const VerificationQueue = () => {
  const [activeTab, setActiveTab] = useState('Chờ thẩm định');

  const [verifications] = useState([
    {
      id: 'VER-2024-089',
      route: 'Hố Thầu - Tả Củ Tỷ',
      submitter: 'Vũ Trí',
      submitterType: 'Trekker Cấp 3',
      submitterId: '#TK-8819',
      time: '20/10/2024 08:30 (Sáng)',
      dist: '38.5 km',
      elev: '+2.400m',
      level: 'Cấp 5 (Cực khó)',
      stops: '6 Trạm dừng',
      water: '4 nguồn',
      sos: '1 SOS (Thiếu)',
      waitTime: '4 ngày 8 giờ',
      isOverdue: true,
      image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=100&auto=format&fit=crop'
    },
    {
      id: 'VER-2024-090',
      route: 'Đỉnh Nam Kang Ho Tao',
      submitter: 'Hoàng Thu Trang',
      submitterType: 'Leader PRO VFRS',
      submitterId: 'Uy tín 99%',
      time: '21/10/2024 20:15 (Tối)',
      dist: '26.0 km',
      elev: '+2.150m',
      level: 'Cấp 4 (Thử thách)',
      stops: '5 Trạm dừng',
      water: '3 nguồn',
      sos: '2 SOS chuẩn',
      waitTime: '2 ngày 18 giờ',
      isOverdue: false,
      image: 'https://images.unsplash.com/photo-1542385150-13f56d95daae?q=80&w=100&auto=format&fit=crop'
    }
  ]);

  return (
    <div className="p-6 bg-gray-50/50 min-h-screen">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2 uppercase">
            <span>Hệ thống Quản trị</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span>Thẩm định dữ liệu</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-900">Hàng đợi Thẩm định Cung đường</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Hàng đợi Thẩm định Cung đường</h1>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">4 hồ sơ đang chờ xử lý</span>
          </div>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">Kiểm tra dữ liệu GPS tracklog, trạm dừng nước, mật độ trạm cứu hộ SOS, quyền truy cập khu bảo tồn thiên nhiên và cấp phép công khai cho cộng đồng trekker.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            Bộ lọc nâng cao
          </button>
          <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Lịch sử thẩm định
          </button>
          <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất báo cáo PDF
          </button>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4 mb-6 shadow-sm">
         <div className="w-8 h-8 bg-red-600 text-white rounded-lg flex items-center justify-center font-bold shrink-0">!</div>
         <div className="flex-1">
            <h4 className="font-bold text-red-800 text-sm mb-1">Cảnh báo SLA: Có 1 hồ sơ đã vượt quá giới hạn 72 giờ cam kết</h4>
            <p className="text-xs text-red-700">Hồ sơ #VER-2024-089 (Hố Thầu - Tả Củ Tỷ) đang chờ 4 ngày 8 giờ. Cần thẩm định viên tiếp nhận ngay để tránh gián đoạn kế hoạch trekker.</p>
         </div>
         <button className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shrink-0">Xử lý ngay</button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50/50 rounded-bl-full"></div>
          <div className="flex justify-between items-start mb-2 relative">
             <div className="text-sm font-bold text-gray-700">Đang chờ duyệt</div>
             <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             </div>
          </div>
          <div className="text-3xl font-black text-gray-900 mb-2">4 <span className="text-sm font-medium text-gray-500">hồ sơ</span></div>
          <div className="text-xs font-bold text-red-600 flex items-center gap-1">
             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             1 hồ sơ quá hạn {'>'}3 ngày
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-50/50 rounded-bl-full"></div>
          <div className="flex justify-between items-start mb-2 relative">
             <div className="text-sm font-bold text-gray-700">Đã duyệt tháng này</div>
             <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
          </div>
          <div className="text-3xl font-black text-gray-900 mb-2">18 <span className="text-sm font-medium text-gray-500">cung đường</span></div>
          <div className="text-xs font-medium text-gray-500 flex justify-between items-center">
             <span>Tỷ lệ duyệt: <span className="font-bold text-gray-900">82%</span></span>
             <span className="text-emerald-600 font-bold">+4 so với tháng trước</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-16 h-16 bg-amber-50/50 rounded-bl-full"></div>
          <div className="flex justify-between items-start mb-2 relative">
             <div className="text-sm font-bold text-gray-700">Từ chối / Cần sửa</div>
             <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
             </div>
          </div>
          <div className="text-3xl font-black text-gray-900 mb-2">4 <span className="text-sm font-medium text-gray-500">hồ sơ</span></div>
          <div className="text-xs font-medium text-gray-500 truncate">
             Lỗi chính: Thiếu SOS / Tracklog...
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-16 h-16 bg-slate-50/50 rounded-bl-full"></div>
          <div className="flex justify-between items-start mb-2 relative">
             <div className="text-sm font-bold text-gray-700">Thời gian xử lý TB</div>
             <div className="w-8 h-8 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
          </div>
          <div className="text-3xl font-black text-gray-900 mb-2">28.5 <span className="text-sm font-medium text-gray-500">giờ / cung</span></div>
          <div className="text-xs font-bold text-emerald-600 flex justify-between items-center">
             <span>Đạt chuẩn SLA (&lt; 48h)</span>
             <span>Tốc độ: 98%</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="border-b border-gray-100 px-2 pt-2 flex justify-between items-end bg-gray-50/30">
            <div className="flex gap-2">
               {['Chờ thẩm định', 'Đã phê duyệt', 'Đã từ chối / Yêu cầu bổ sung'].map(tab => (
                  <button 
                     key={tab}
                     onClick={() => setActiveTab(tab)}
                     className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === tab ? 'border-[#1B5E41] text-[#1B5E41]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                  >
                     {tab}
                     {tab === 'Chờ thẩm định' && <span className="ml-2 bg-amber-400 text-black text-[10px] px-1.5 py-0.5 rounded-full">4</span>}
                     {tab === 'Đã phê duyệt' && <span className="ml-2 bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.5 rounded-full">142</span>}
                     {tab === 'Đã từ chối / Yêu cầu bổ sung' && <span className="ml-2 bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.5 rounded-full">23</span>}
                  </button>
               ))}
            </div>
            <div className="px-4 py-3 text-xs text-gray-500 font-medium flex items-center gap-1">
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
               Cập nhật 2 phút trước
            </div>
         </div>
         
         <div className="p-4 border-b border-gray-100 flex gap-4 bg-white">
            <div className="relative flex-[2]">
               <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               <input type="text" placeholder="Tìm kiếm theo mã hồ sơ, tên cung đường..." className="w-full bg-gray-50 border border-gray-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
            </div>
            <select className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium py-2 px-3 focus:outline-none focus:border-emerald-500">
               <option>Người gửi: Tất cả</option>
            </select>
            <select className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium py-2 px-3 focus:outline-none focus:border-emerald-500">
               <option>Khu vực: Tất cả vùng núi</option>
            </select>
            <select className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium py-2 px-3 focus:outline-none focus:border-emerald-500">
               <option>Sắp xếp: Cũ nhất trước (SLA)</option>
            </select>
         </div>

         <div className="overflow-x-auto bg-white">
            <table className="w-full text-left text-sm">
               <thead className="bg-[#EEF2F6] text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                     <th className="py-3 px-4 w-1/3">Cung đường & Mã hồ sơ</th>
                     <th className="py-3 px-4">Người nộp</th>
                     <th className="py-3 px-4">Thời điểm gửi</th>
                     <th className="py-3 px-4">Thông số kỹ thuật</th>
                     <th className="py-3 px-4">Trạm & An toàn</th>
                     <th className="py-3 px-4">Thời gian chờ (SLA)</th>
                     <th className="py-3 px-4 text-center">Hành động</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                  {activeTab === 'Chờ thẩm định' ? verifications.map(v => (
                     <tr key={v.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="py-4 px-4">
                           <div className="flex items-center gap-3">
                              <div className="relative">
                                 <img src={v.image} className="w-12 h-12 rounded object-cover" alt="" />
                                 <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5 rounded-b">GPX</div>
                              </div>
                              <div>
                                 <div className="flex items-center gap-2 mb-0.5">
                                    <h4 className="font-bold text-gray-900 text-[13px]">{v.route}</h4>
                                    <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">Thám hiểm</span>
                                 </div>
                                 <div className="text-[11px] text-gray-500 mb-1">
                                    <span className="font-bold">{v.id}</span> • Hà Giang
                                 </div>
                                 {v.isOverdue && (
                                    <div className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                                       <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                       Thiếu trạm cứu hộ SOS tại mốc KM24
                                    </div>
                                 )}
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-4">
                           <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">VT</div>
                              <div>
                                 <div className="font-bold text-gray-900 text-xs">{v.submitter}</div>
                                 <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                                    <span className="bg-gray-100 px-1 py-0.5 rounded">{v.submitterType}</span>
                                    <span>• {v.submitterId}</span>
                                 </div>
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-4">
                           <div className="text-xs font-bold text-gray-900">{v.time.split(' ')[0]}</div>
                           <div className="text-[11px] text-gray-500">{v.time.split(' ').slice(1).join(' ')}</div>
                        </td>
                        <td className="py-4 px-4">
                           <div className="text-xs font-black text-gray-900">{v.dist} • {v.elev}</div>
                           <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${v.level.includes('Cực khó') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {v.level}
                           </div>
                        </td>
                        <td className="py-4 px-4">
                           <div className="text-[11px] text-gray-600 space-y-1">
                              <div><span className="font-bold">{v.stops}</span> dừng</div>
                              <div><span className="font-bold">{v.water}</span> nguồn</div>
                              <div className={v.sos.includes('Thiếu') ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
                                 * {v.sos}
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-4">
                           <div className={`p-2 rounded-lg text-center ${v.isOverdue ? 'bg-red-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                              <div className="font-black text-xs">{v.waitTime.split(' ')[0]} {v.waitTime.split(' ')[1]}</div>
                              <div className="font-black text-xs">{v.waitTime.split(' ')[2]} {v.waitTime.split(' ')[3]}</div>
                              <div className="text-[9px] font-medium mt-1 flex justify-center items-center gap-1">
                                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                 {v.isOverdue ? '(Quá hạn SLA)' : '(Sắp hết hạn)'}
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                           <Link href={`/admin/verifications/${v.id}`} className="inline-flex w-8 h-8 rounded bg-[#1B5E41] hover:bg-[#154B36] text-white items-center justify-center transition-colors shadow-sm">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                           </Link>
                        </td>
                     </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500 text-sm">
                        Không có hồ sơ nào trong trạng thái này.
                      </td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
         <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
            <span className="text-xs text-gray-500 font-medium">Hiển thị {verifications.length} trong tổng số 4 hồ sơ cần thẩm định</span>
            <div className="flex gap-1">
               <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-400">&lt;</button>
               <button className="w-7 h-7 flex items-center justify-center rounded bg-[#1B5E41] text-white font-bold text-xs">1</button>
               <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-400">&gt;</button>
            </div>
         </div>
      </div>
    </div>
  );
};
