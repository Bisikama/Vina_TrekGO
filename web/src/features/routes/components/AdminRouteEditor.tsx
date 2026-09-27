"use client";
import React, { useState } from 'react';

export const AdminRouteEditor = () => {
  const [routeName, setRouteName] = useState('Sống Lưng Khủng Long Tà Xùa');
  const [routeType, setRouteType] = useState('Hiking/Trek');
  const [checkpoints, setCheckpoints] = useState([
    { id: 1, name: 'Chân bản Chống Tra (Xuất phát)', km: '0.0', alt: '1.250', sos: false, desc: 'Tập kết đoàn, kiểm tra quân tư trang và gửi xe.' },
    { id: 2, name: 'Rừng trúc & Mỏm Đầu Rùa', km: '4.2', alt: '1.850', sos: true, desc: 'Trạm nghỉ chân uống nước, khu vực này sóng chập chờn.' }
  ]);

  const handleAddCheckpoint = () => {
    const newId = checkpoints.length > 0 ? Math.max(...checkpoints.map(c => c.id)) + 1 : 1;
    setCheckpoints([...checkpoints, {
      id: newId,
      name: 'Điểm dừng mới',
      km: '...',
      alt: '...',
      sos: false,
      desc: 'Mô tả chi tiết...'
    }]);
  };

  const handleRemoveCheckpoint = (id: number) => {
    setCheckpoints(checkpoints.filter(c => c.id !== id));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 shadow-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                Đang hoạt động / Public
              </span>
              <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200">#TRL-TX01</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Chinh phục {routeName}</h1>
          </div>
        </div>
        <div className="flex gap-3">
           <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
             Xem trước (Trekker)
           </button>
           <button className="bg-[#1B5E41] hover:bg-[#154B36] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             Lưu cập nhật
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column - Route Information */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Thông tin cơ bản
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên cung đường công khai <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Điểm đến / Vùng núi</label>
                  <select className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors">
                    <option>Tà Xùa (Bắc Yên, Sơn La)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mã định danh</label>
                  <input type="text" defaultValue="#TRL-TX01" className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phân loại thể loại tuyến</label>
                <div className="grid grid-cols-3 gap-3">
                  {['Hiking/Trek', 'Expedition', 'Trail Run'].map((type) => (
                    <label 
                      key={type}
                      onClick={() => setRouteType(type)}
                      className={`${routeType === type ? 'border-emerald-500 bg-emerald-50 border-2' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 border'} rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-colors relative`}
                    >
                      {routeType === type && (
                        <div className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                           <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                      <svg className={`w-6 h-6 mb-1 ${routeType === type ? 'text-emerald-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {type === 'Hiking/Trek' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />}
                        {type === 'Expedition' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                        {type === 'Trail Run' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />}
                      </svg>
                      <span className={`text-xs ${routeType === type ? 'font-bold text-emerald-700' : 'font-medium text-gray-600'}`}>{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Thông số kỹ thuật
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                <div className="text-[10px] font-bold text-gray-500 mb-1">TỔNG CỰ LY</div>
                <div className="text-xl font-black text-gray-900">14.5 <span className="text-xs font-medium text-gray-500">km</span></div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                <div className="text-[10px] font-bold text-gray-500 mb-1">ĐỘ DỐC (+GAIN)</div>
                <div className="text-xl font-black text-emerald-600">+1615 <span className="text-xs font-medium text-emerald-600/70">m</span></div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                <div className="text-[10px] font-bold text-gray-500 mb-1">ĐỈNH CỰC ĐẠI</div>
                <div className="text-xl font-black text-gray-900">2865 <span className="text-xs font-medium text-gray-500">m</span></div>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                <div className="text-[10px] font-bold text-gray-500 mb-1">ĐỘ CAO XUẤT PHÁT</div>
                <div className="text-xl font-black text-gray-900">1250 <span className="text-xs font-medium text-gray-500">m</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Map & Checkpoints */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                <span className="font-bold text-sm">Biên tập Bản đồ GPS Vệ tinh</span>
              </div>
              <div className="flex gap-2">
                <button className="bg-slate-700 hover:bg-slate-600 text-xs px-2 py-1 rounded border border-slate-600 transition-colors">Vệ tinh</button>
                <button className="bg-slate-700 hover:bg-slate-600 text-xs px-2 py-1 rounded border border-slate-600 transition-colors">Địa hình</button>
              </div>
            </div>
            <div className="h-[300px] bg-gray-100 flex items-center justify-center text-gray-400 relative">
               {/* Giả lập map */}
               <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
               <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 text-white rounded-lg p-3 flex justify-between items-center backdrop-blur text-xs">
                  <div className="flex gap-4">
                     <div><span className="text-gray-400">Độ dài:</span> <span className="font-bold text-emerald-400">14.5 KM</span></div>
                     <div><span className="text-gray-400">Trạm:</span> <span className="font-bold">5 Checkpoints</span></div>
                  </div>
                  <div><span className="text-gray-400">GPS Vệ tinh:</span> <span className="font-bold text-emerald-400">Chuẩn xác 100%</span></div>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Quản lý Điểm dừng & Checkpoints
            </h3>
            
            <div className="space-y-3 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              
              {checkpoints.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200 relative z-10">
                  Chưa có trạm dừng nào.
                </div>
              ) : checkpoints.map((cp, index) => (
                <div key={cp.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-4 border-white ${index === 0 ? 'bg-emerald-500' : 'bg-gray-300'} text-white font-bold text-xs shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
                    {index + 1}
                  </div>
                  <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-white border border-gray-200 p-4 rounded-xl shadow-sm relative group">
                    <button 
                      onClick={() => handleRemoveCheckpoint(cp.id)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <div className="flex items-center justify-between mb-1 pr-6">
                      <h4 className="font-bold text-gray-900 text-sm">{cp.name}</h4>
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Km {cp.km}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> {cp.alt}m</span>
                      {cp.sos && <span className="text-red-500 font-bold">• Trạm SOS #0{index}</span>}
                    </div>
                    <p className="text-[11px] text-gray-600 line-clamp-2">{cp.desc}</p>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={handleAddCheckpoint}
                className="w-full mt-4 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 text-gray-500 text-xs font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 relative z-10"
              >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                 Thêm điểm dừng mới
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
