import Image from "next/image";

export const UpcomingTripHero = () => {
  return (
    <div className="mb-12">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[17px] font-extrabold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#154B36]"></span>
          Chuyến đi sắp tới của bạn
        </h2>
        <span className="text-[11px] text-gray-400 font-medium">Lịch trình tự động đồng bộ theo múi giờ GMT+7</span>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col md:flex-row">
        {/* Left Side: Image */}
        <div className="w-full md:w-5/12 relative h-64 md:h-auto">
          <Image 
            src="/hero-trekking.jpg" 
            alt="Núi Bà Đen View" 
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            <span className="bg-white/90 backdrop-blur text-gray-900 px-3 py-1 rounded-full text-[10px] font-bold">Cung đường mã số: BD-0986</span>
            <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">1 Ngày • Leo dốc</span>
          </div>

          <div className="absolute bottom-4 left-4 text-white">
            <div className="flex items-center gap-1.5 text-[11px] font-medium mb-1 opacity-90">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Thời tiết lý tưởng, nắng ráo quang mây
            </div>
            <h3 className="text-2xl font-black tracking-tight">Núi Bà Đen • 986m</h3>
          </div>
        </div>

        {/* Right Side: Details */}
        <div className="w-full md:w-7/12 p-6 lg:p-8 flex flex-col">
          {/* Countdown */}
          <div className="flex items-center justify-between bg-[#F8FAFC] border border-gray-100 rounded-xl px-4 py-3 mb-6">
            <div className="flex items-center gap-2 text-[#154B36] font-bold text-[12px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Đếm ngược giờ xuất phát:
            </div>
            <div className="flex items-center gap-2">
              <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-2.5 py-1 text-center min-w-[60px]">
                <div className="text-[13px] font-black text-gray-900 leading-none">03 NGÀY</div>
              </div>
              <span className="text-gray-300 font-bold">:</span>
              <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-2.5 py-1 text-center min-w-[60px]">
                <div className="text-[13px] font-black text-gray-900 leading-none">14 GIỜ</div>
              </div>
              <span className="text-gray-300 font-bold">:</span>
              <div className="bg-white border border-gray-200 shadow-sm rounded-lg px-2.5 py-1 text-center min-w-[60px]">
                <div className="text-[13px] font-black text-gray-900 leading-none">35 PHÚT</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-2 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Khởi hành: Thứ Bảy hàng tuần • Kết thúc: Trong ngày
          </div>
          <h3 className="text-[22px] font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
            Núi Bà Đen - Nóc Nhà Nam Bộ & Cung Đường Cột Điện (1 Ngày)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F0FDF4] text-[#154B36] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-900 mb-0.5">Điểm tập kết xe & giờ hẹn</div>
                <div className="text-[13px] font-black text-[#154B36] mb-1">05:30 AM (29/11)</div>
                <div className="text-[11px] text-gray-500 leading-tight">Cổng ĐH Sư Phạm Hà Nội (136 Xuân Thủy, Cầu Giấy)</div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                <Image src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop" alt="Leader" width={40} height={40} className="object-cover h-full w-full" />
              </div>
              <div>
                <div className="text-[10px] text-gray-500 mb-0.5">Mountain Leader phụ trách</div>
                <div className="text-[13px] font-bold text-gray-900 mb-1 flex items-center gap-1">
                  Hoàng Thu Trang
                  <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                </div>
                <div className="text-[11px] text-gray-500 font-medium">★ 4.98 • 42 tour an toàn • WFA Certified</div>
              </div>
            </div>
          </div>

          <div className="bg-[#F8FAFC] rounded-xl p-4 mb-6 border border-gray-100 relative overflow-hidden">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                Trắc đồ độ cao hành trình: 1.250m → 2.865m
              </span>
              <span className="text-[10px] font-bold text-[#154B36]">Đèo Gió 28°</span>
            </div>
            {/* Mock Elevation Graph */}
            <div className="w-full h-8 flex items-end opacity-70">
              <div className="w-1/6 bg-emerald-200 h-[20%] rounded-t-sm"></div>
              <div className="w-1/6 bg-emerald-300 h-[40%] rounded-t-sm"></div>
              <div className="w-1/6 bg-emerald-400 h-[70%] rounded-t-sm"></div>
              <div className="w-1/6 bg-emerald-500 h-[100%] rounded-t-sm relative">
                <div className="absolute -top-1 left-1/2 w-2 h-2 bg-red-500 rounded-full border-2 border-white -translate-x-1/2"></div>
              </div>
              <div className="w-1/6 bg-emerald-400 h-[80%] rounded-t-sm"></div>
              <div className="w-1/6 bg-emerald-300 h-[50%] rounded-t-sm"></div>
            </div>
            <div className="w-full border-t border-emerald-500 mt-0.5 relative"></div>
          </div>

          <div className="mt-auto flex flex-wrap gap-3">
            <button className="bg-[#154B36] hover:bg-[#0D3425] text-white px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
              Xem vé & Chi tiết chuyến đi
            </button>
            <button className="bg-[#F1F5F9] hover:bg-[#E2E8F0] text-gray-700 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              Mã QR Check-in
            </button>
            <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-2 sm:ml-auto">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Tải danh sách đồ cá nhân
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
