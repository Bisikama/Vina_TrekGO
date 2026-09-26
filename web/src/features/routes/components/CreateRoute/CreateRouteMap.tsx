import React from 'react';

export const CreateRouteMap = () => {
  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Map Header Controls */}
      <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-white z-10 relative">
        <div className="flex gap-1">
          <button className="px-3 py-1.5 text-[10px] font-bold bg-[#1B4332] text-white rounded">Địa hình 3D</button>
          <button className="px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-50 rounded">Vệ tinh</button>
          <button className="px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:bg-gray-50 rounded">Bản đồ chuẩn</button>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded tracking-wider">
            HDOP: <span className="text-gray-900">1.2 (Tốt)</span>
          </div>
          <button className="px-3 py-1.5 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 rounded flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Vẽ lộ trình
          </button>
          <button className="p-1.5 text-gray-500 hover:bg-gray-50 rounded border border-gray-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button className="p-1.5 text-gray-500 hover:bg-gray-50 rounded border border-gray-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </button>
        </div>
      </div>
      
      {/* Map Area Mock */}
      <div className="relative h-[300px] w-full bg-blue-50/50 overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 800 300">
          <path d="M100,200 C300,250 400,100 600,150 L750,50" fill="none" stroke="#eab308" strokeWidth="4" strokeDasharray="8 4" />
        </svg>
        
        {/* Checkpoint 1 */}
        <div className="absolute top-[200px] left-[100px] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow mb-1 whitespace-nowrap">Trạm Kiểm Lâm (KM 0 • 720m)</div>
          <div className="w-6 h-6 bg-[#1B4332] text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm font-bold text-[10px]">1</div>
        </div>
        
        {/* Checkpoint 2 */}
        <div className="absolute top-[175px] left-[350px] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="bg-white text-gray-900 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded shadow mb-1 whitespace-nowrap flex items-center gap-1">
            <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            CP2: Suối Đá Trắng (850m)
          </div>
          <div className="w-6 h-6 bg-white text-gray-900 rounded-full flex items-center justify-center border-2 border-gray-300 shadow-sm font-bold text-[10px]">2</div>
        </div>
        
        {/* Checkpoint 3 */}
        <div className="absolute top-[125px] left-[500px] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="bg-white text-gray-900 border border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded shadow mb-1 whitespace-nowrap flex items-center gap-1">
            <svg className="w-3 h-3 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            CP3: Bãi Lán Thác K5 (940m)
          </div>
          <div className="w-6 h-6 bg-white text-gray-900 rounded-full flex items-center justify-center border-2 border-gray-300 shadow-sm font-bold text-[10px]">3</div>
        </div>
        
        {/* Checkpoint 4 */}
        <div className="absolute top-[50px] left-[750px] transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
          <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow mb-1 whitespace-nowrap flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
            CP4: Cửa Rừng Buôn Lưới
          </div>
          <div className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm font-bold text-[10px]">4</div>
        </div>
        
        {/* Zoom Controls */}
        <div className="absolute right-3 top-3 flex flex-col shadow rounded-lg overflow-hidden border border-gray-200">
          <button className="w-8 h-8 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 border-b border-gray-200">+</button>
          <button className="w-8 h-8 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50">-</button>
        </div>
      </div>
      
      {/* Elevation Profile */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <div className="text-[10px] font-medium text-gray-500">Đồ thị trắc diện 18.5 km</div>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Lộ trình an toàn</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Đoạn dốc cao</span>
          </div>
        </div>
        <div className="h-12 w-full flex items-end">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <path d="M0,100 L0,80 Q25,70 50,40 T100,50 L100,100 Z" fill="#dcfce7" opacity="0.5" />
            <path d="M0,80 Q25,70 50,40 T100,50" fill="none" stroke="#16a34a" strokeWidth="2" />
          </svg>
        </div>
      </div>
      
      {/* Checkpoints List */}
      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-gray-900">Danh Sách Trạm Dừng & Điểm Mốc An Toàn (Checkpoints)</h3>
            <p className="text-xs text-gray-500 mt-0.5">Kéo thả để sắp xếp lại thứ tự hành trình. Điểm đầu và cuối tự động gắn nhãn.</p>
          </div>
          <button className="px-3 py-1.5 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded flex items-center gap-1.5 hover:bg-gray-50 shadow-sm shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Thêm trạm thủ công
          </button>
        </div>
        
        <div className="space-y-3">
          {/* CP1 */}
          <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm group">
            <div className="cursor-grab text-gray-300 hover:text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
            </div>
            <div className="bg-[#1B4332] text-white text-[10px] font-bold px-2 py-0.5 rounded shrink-0">1. XUẤT PHÁT</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-gray-900 truncate">Trạm Kiểm Lâm Kon Chu Răng</h4>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">720m</span>
              </div>
              <div className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                14.5628° N, 108.5612° E • Đăng ký kiểm lâm & Điểm gửi xe
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
              <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>
          
          {/* CP2 */}
          <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm group">
            <div className="cursor-grab text-gray-300 hover:text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
            </div>
            <div className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded shrink-0">2. Trạm dừng</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-gray-900 truncate">Suối Đá Trắng (Nguồn nước)</h4>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">850m</span>
              </div>
              <div className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                14.5310° N, 108.5848° E • Nước ngọt quanh năm, có thể lọc uống trực tiếp
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
              <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>
          
          {/* CP3 */}
          <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm group">
            <div className="cursor-grab text-gray-300 hover:text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
            </div>
            <div className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded shrink-0">3. Trạm hạ trại</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-gray-900 truncate">Bãi Lán Thác K5</h4>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">940m</span>
              </div>
              <div className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                14.5685° N, 108.6128° E • Khu đất bằng phẳng 8 lều, gió to sau 19:00
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
              <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>
          
          {/* CP4 */}
          <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm group">
            <div className="cursor-grab text-gray-300 hover:text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
            </div>
            <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shrink-0">4. ĐIỂM KẾT THÚC</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-gray-900 truncate">Cửa Rừng Buôn Lưới</h4>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">688m</span>
              </div>
              <div className="text-xs text-gray-500 truncate flex items-center gap-1.5 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                14.5940° N, 108.6388° E • Sóng Viettel 4G ổn định, ô tô 16 chỗ đón được
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
              <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
