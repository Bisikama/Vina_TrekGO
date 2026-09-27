import React from 'react';

export const RouteSummaryCard = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 flex flex-col xl:flex-row gap-6">
      <div className="flex-1">
        <div className="flex gap-2 mb-3">
          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Gia Lai - Tây Nguyên</span>
          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">Rừng đặc dụng</span>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Tuyến Thác K5 - Rừng Nguyên Sinh Kon Chu Răng</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Cự ly
            </div>
            <div className="text-xl font-bold text-gray-900">18.5 <span className="text-sm font-medium text-gray-500">km</span></div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Độ cao tích lũy
            </div>
            <div className="text-xl font-bold text-gray-900">+890 <span className="text-sm font-medium text-gray-500">m</span></div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Thời gian
            </div>
            <div className="text-xl font-bold text-gray-900">2N1Đ</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
              Điểm dừng
            </div>
            <div className="text-xl font-bold text-gray-900">4 <span className="text-sm font-medium text-gray-500">trạm</span></div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
            <img src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop" alt="User" className="w-full h-full object-cover" />
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-4">
            <div>Khởi tạo bởi <span className="font-bold text-gray-900">Nguyễn Hùng</span> (Trekker Level 3)</div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div>15/11/2024</div>
            <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
            <div>Bản ghi vệ tinh Garmin InReach</div>
          </div>
        </div>
      </div>
      
      <div className="w-full xl:w-[400px] shrink-0 border-t xl:border-t-0 xl:border-l border-gray-100 pt-5 xl:pt-0 xl:pl-6 flex flex-col gap-4">
        {/* Map Thumbnail Mock */}
        <div className="h-[120px] bg-blue-50 rounded-lg relative overflow-hidden border border-gray-200">
          <div className="absolute top-2 left-2 bg-white/90 text-[10px] font-bold text-gray-700 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            GPX Tracklog: Đã đồng bộ
          </div>
          <div className="absolute bottom-2 right-2 bg-gray-900/80 text-[10px] font-bold text-white px-2 py-0.5 rounded shadow-sm backdrop-blur-sm">
            HDOP: 1.2 (Rất chuẩn xác)
          </div>
          {/* Mock Route Line */}
          <svg className="w-full h-full absolute inset-0 drop-shadow-md" viewBox="0 0 400 120">
            <path d="M50,80 Q100,20 150,60 T250,40 T350,70" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="50" cy="80" r="4" fill="white" stroke="#16a34a" strokeWidth="2" />
            <circle cx="350" cy="70" r="4" fill="white" stroke="#dc2626" strokeWidth="2" />
          </svg>
        </div>
        
        <div>
          <div className="flex justify-between items-end mb-2">
            <div className="text-[10px] font-medium text-gray-500">Hồ sơ cao độ địa hình (Elevation Profile)</div>
            <div className="text-[10px] font-bold text-gray-700">Min 410m — Max 1.050m</div>
          </div>
          <div className="h-10 w-full flex items-end">
            <svg className="w-full h-full drop-shadow-sm" preserveAspectRatio="none" viewBox="0 0 100 100">
              <path d="M0,100 L0,70 Q25,20 50,40 T100,50 L100,100 Z" fill="#dcfce7" opacity="0.5" />
              <path d="M0,70 Q25,20 50,40 T100,50" fill="none" stroke="#16a34a" strokeWidth="2.5" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
