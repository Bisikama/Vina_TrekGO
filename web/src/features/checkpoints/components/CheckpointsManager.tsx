"use client";
import React, { useState } from 'react';

export const CheckpointsManager = () => {
  const [activeCategory, setActiveCategory] = useState('Tất cả phân loại (216)');
  const [activeRegion, setActiveRegion] = useState('Tây Bắc (Lào Cai, Yên Bái, Lai Châu)');
  
  const [checkpoints, setCheckpoints] = useState([
    {
      id: 'CP-TX03',
      name: 'Lán nghỉ Sống Lưng Khủng Long',
      location: 'Tà Xùa, Bắc Yên',
      type: 'Lán trại',
      elevation: '2.450 m',
      status: 'ACTIVE PIN',
      tags: ['4G Viettel (3 vạch)', 'Nguồn nước ngầm 80m'],
      image: 'https://images.unsplash.com/photo-1516654867499-52e8964344bd?q=80&w=100&auto=format&fit=crop'
    },
    {
      id: 'CP-FN01',
      name: 'Cột mốc Đỉnh Fansipan',
      location: 'Vườn Quốc gia Hoàng Liên',
      type: 'Đỉnh núi',
      elevation: '3.143 m',
      status: '',
      tags: ['Đỉnh cao nhất VN'],
      image: 'https://images.unsplash.com/photo-1542385150-13f56d95daae?q=80&w=100&auto=format&fit=crop'
    },
    {
      id: 'CP-TX01',
      name: 'Mỏm Đầu Rùa Checkpoint',
      location: 'Bản Tà Xùa',
      type: 'Ngắm cảnh',
      elevation: '1.920 m',
      status: '',
      tags: ['Vực sâu gió lốc'],
      image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=100&auto=format&fit=crop'
    },
    {
      id: 'CP-BM02',
      name: 'Lán nghỉ 2 - Bạch Mộc (Kỳ Quan San)',
      location: 'Sàng Ma Sáo, Bát Xát',
      type: 'Lán trại',
      elevation: '2.840 m',
      status: '',
      tags: ['Bể nước mưa 3000L', 'Cột SOS #08'],
      image: 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?q=80&w=100&auto=format&fit=crop'
    }
  ]);

  const handleDelete = (id: string) => {
    setCheckpoints(checkpoints.filter(cp => cp.id !== id));
  };

  const handleAdd = () => {
    setCheckpoints([{
      id: 'CP-NEW',
      name: 'Trạm dừng mới',
      location: 'Vị trí chưa xác định',
      type: 'Lán trại',
      elevation: '0 m',
      status: '',
      tags: [],
      image: 'https://images.unsplash.com/photo-1520643797685-64bc0b37fc70?q=80&w=100&auto=format&fit=crop'
    }, ...checkpoints]);
  };

  return (
    <div className="p-6 bg-gray-50/50 min-h-screen">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-2 uppercase">
            <span>Quản trị hệ thống</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            <span className="text-gray-900">Trạm dừng Checkpoints</span>
          </div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Quản lý Trạm dừng Checkpoints</h1>
            <span className="bg-gray-200 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">216 trạm toàn quốc</span>
          </div>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">Số hóa địa hình GPS, định vị tài nguyên nước, lán trại lưu trú và điểm cứu hộ toàn diện cho các cung đường trekking.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Xuất dữ liệu KML/CSV
          </button>
          <button onClick={handleAdd} className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Thêm trạm dừng mới
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">54</div>
            <div className="text-xs font-bold text-gray-500">Đỉnh núi / Summits</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">48</div>
            <div className="text-xs font-bold text-gray-500">Điểm ngắm cảnh</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center text-teal-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">62</div>
            <div className="text-xs font-bold text-gray-500">Nguồn nước sạch</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">52</div>
            <div className="text-xs font-bold text-gray-500">Lán trại & Trạm nghỉ</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Tìm kiếm trạm dừng..." className="w-full bg-gray-50 pl-10 pr-4 py-2.5 rounded-lg text-sm border-none focus:ring-1 focus:ring-emerald-500 outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500">Phân loại:</span>
          <select value={activeCategory} onChange={(e)=>setActiveCategory(e.target.value)} className="bg-gray-50 border-none rounded-lg text-sm font-medium py-2.5 px-3 focus:ring-1 focus:ring-emerald-500 outline-none">
            <option>Tất cả phân loại (216)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500">Khu vực:</span>
          <select value={activeRegion} onChange={(e)=>setActiveRegion(e.target.value)} className="bg-gray-50 border-none rounded-lg text-sm font-medium py-2.5 px-3 focus:ring-1 focus:ring-emerald-500 outline-none">
            <option>Tây Bắc (Lào Cai, Yên Bái, Lai Châu)</option>
          </select>
        </div>
        <select className="bg-gray-50 border-none rounded-lg text-sm font-medium py-2.5 px-3 focus:ring-1 focus:ring-emerald-500 outline-none">
          <option>Sắp xếp: Độ cao giảm dần</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Danh sách Trạm dừng</h3>
              <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
                <span>Tây Bắc: 7 trạm hiển thị</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Trực quan hóa GPS thời gian thực</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {checkpoints.map(cp => (
                <div key={cp.id} className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${cp.status === 'ACTIVE PIN' ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <img src={cp.image} alt={cp.name} className="w-16 h-16 rounded-lg object-cover bg-gray-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-900 truncate text-sm">{cp.name}</h4>
                      {cp.status === 'ACTIVE PIN' && <span className="bg-[#1B5E41] text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">{cp.status}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mb-1.5 truncate">
                      <span className="font-medium text-gray-700">#{cp.id}</span> • {cp.location}
                    </div>
                    <div className="flex gap-2">
                      {cp.tags.map(tag => (
                        <span key={tag} className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${cp.type === 'Lán trại' ? 'bg-emerald-100 text-emerald-800' : cp.type === 'Đỉnh núi' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                         {cp.type}
                       </span>
                       <span className="text-sm font-black text-gray-900">{cp.elevation}</span>
                    </div>
                    <div className="flex gap-2">
                       <button className="text-gray-400 hover:text-emerald-600 transition-colors text-xs font-semibold">Sửa</button>
                       <button onClick={() => handleDelete(cp.id)} className="text-gray-400 hover:text-red-600 transition-colors text-xs font-semibold">Xóa</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
               <span className="text-xs text-gray-500 font-medium">Hiển thị 1 - {checkpoints.length} trong tổng số 216 trạm dừng</span>
               <div className="flex gap-1">
                  <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-400">&lt;</button>
                  <button className="w-7 h-7 flex items-center justify-center rounded bg-[#1B5E41] text-white font-bold text-xs">1</button>
                  <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs">2</button>
                  <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs">3</button>
                  <button className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white text-gray-400">&gt;</button>
               </div>
            </div>
          </div>
        </div>
        
        {/* Right Column: Preview Map & Details */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-2">
             <div className="h-[240px] bg-emerald-50 rounded-lg relative flex items-center justify-center overflow-hidden">
                <div className="absolute top-3 left-3 flex gap-1">
                   <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">Địa hình</span>
                   <span className="bg-white text-gray-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm">Vệ tinh</span>
                </div>
                <div className="absolute top-3 right-3 bg-white text-gray-900 text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   GPS: ±1.2m
                </div>
                
                {/* Mock Map Element */}
                <div className="absolute text-center group cursor-pointer">
                   <div className="bg-white px-2 py-1 rounded shadow text-xs font-bold mb-1">Lán nghỉ CP-TX03</div>
                   <div className="w-8 h-8 bg-[#1B5E41] text-white rounded-full flex items-center justify-center mx-auto shadow-lg border-2 border-white">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                   </div>
                </div>
                
                <div className="absolute right-3 bottom-3 flex flex-col gap-1">
                   <button className="w-7 h-7 bg-white rounded shadow text-gray-600 font-bold flex items-center justify-center">+</button>
                   <button className="w-7 h-7 bg-white rounded shadow text-gray-600 font-bold flex items-center justify-center">-</button>
                   <button className="w-7 h-7 bg-white rounded shadow text-red-500 font-bold flex items-center justify-center mt-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                   </button>
                </div>
             </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
             <div className="flex gap-4 mb-4">
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded uppercase">Trạm đang chọn</span>
                      <span className="text-[10px] text-gray-500 font-bold">MÃ: CP-TX03</span>
                   </div>
                   <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">Lán nghỉ Sống Lưng Khủng Long</h3>
                   <p className="text-xs text-gray-500">Vùng núi Tà Xùa, Huyện Bắc Yên, Tỉnh Sơn La</p>
                </div>
                <img src="https://images.unsplash.com/photo-1516654867499-52e8964344bd?q=80&w=100&auto=format&fit=crop" className="w-14 h-14 rounded-lg object-cover bg-gray-100" alt="" />
             </div>
             
             <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg mb-4">
                <div>
                   <div className="text-[10px] text-gray-500 font-bold">ĐỘ CAO</div>
                   <div className="font-black text-gray-900">2.450 m</div>
                </div>
                <div>
                   <div className="text-[10px] text-gray-500 font-bold">ÁP SUẤT</div>
                   <div className="font-black text-gray-900">755 hPa</div>
                </div>
                <div>
                   <div className="text-[10px] text-gray-500 font-bold">NHIỆT ĐỘ TB</div>
                   <div className="font-black text-gray-900">14°C - 19°C</div>
                </div>
             </div>
             
             <div className="mb-4">
                <div className="text-xs font-bold text-gray-900 mb-2 uppercase">Hạ tầng & Tiện ích thực địa</div>
                <div className="grid grid-cols-2 gap-2">
                   <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-600 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Trạm pin mặt trời VFRS
                   </div>
                   <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-600 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Lán gỗ sức chứa 60 người
                   </div>
                   <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-600 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                      Mạch ngầm cách 80m
                   </div>
                   <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-600 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      Cột phát tín hiệu SOS #03
                   </div>
                </div>
             </div>
             
             <div className="flex gap-2">
                <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                   Chỉnh sửa tọa độ
                </button>
                <button className="flex-1 bg-[#1B5E41] hover:bg-[#154B36] text-white font-bold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                   Xem 3 cung đường
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
