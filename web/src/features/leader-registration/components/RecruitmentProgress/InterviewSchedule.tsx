import React from 'react';

export const InterviewSchedule = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden mb-6 relative">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500"></div>
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">Lịch Hẹn Phỏng Vấn Thực Địa & Kỹ Năng Cứu Hộ</h3>
              <p className="text-xs text-gray-500">Vòng kiểm tra bắt buộc trước khi cấp chứng chỉ chính thức</p>
            </div>
          </div>
          <div className="bg-orange-50 text-orange-700 font-bold text-sm px-3 py-1.5 rounded-lg border border-orange-100 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Còn 4 ngày
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-start gap-3">
            <div className="w-8 h-8 bg-white shadow-sm border border-gray-200 text-gray-600 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Thời gian tập trung</div>
              <div className="font-bold text-gray-900 text-sm">08:30 Sáng — Thứ Bảy</div>
              <div className="text-xs text-gray-900 font-bold">23/11/2024 <span className="font-normal text-gray-500">(Thời lượng: ~4 tiếng)</span></div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-start gap-3">
            <div className="w-8 h-8 bg-white shadow-sm border border-gray-200 text-gray-600 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Địa điểm tập kết</div>
              <div className="font-bold text-gray-900 text-sm">Trạm Cứu Hộ Vườn Quốc Gia Ba Vì</div>
              <div className="text-xs text-gray-500 mb-1">Km 8, Cốt 400m, Xã Ba Vì, Huyện Ba Vì, Hà Nội</div>
              <a href="#" className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                Xem bản đồ & Chỉ đường <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden h-32 mb-6 border border-gray-200">
          <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" alt="Map" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px]"></div>
          <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 text-[10px] flex items-center gap-2 border border-white">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="font-medium text-gray-800">Điểm tập kết: Trạm Trưởng kiểm lâm Cốt 400</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">Tọa độ: 21.0827° N, 105.3621° E</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
            <svg className="w-4 h-4 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Hội Đồng Giám Sát & Chuyên Gia Phỏng Vấn
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex-1">
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80" className="w-10 h-10 rounded-full" alt="Vũ Hoàng Nam" />
              <div>
                <div className="font-bold text-gray-900 text-sm">Vũ Hoàng Nam</div>
                <div className="text-[10px] text-gray-500">Chuyên gia Sinh tồn • WFA Level 4</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100 flex-1">
              <div className="w-10 h-10 rounded-full bg-[#1B4332] text-white flex items-center justify-center font-bold text-xs">VFRS</div>
              <div>
                <div className="font-bold text-gray-900 text-sm">Đại Diện VFRS Safety</div>
                <div className="text-[10px] text-gray-500">Hội Cứu Trợ Khẩn Cấp Việt Nam</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50/50 rounded-xl p-4 border border-green-100">
            <div className="flex items-center gap-2 font-bold text-green-900 text-sm mb-3">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Nội Dung Sát Hạch Thực Địa
            </div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <svg className="w-3 h-3 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Thực hành sơ cứu cố định gãy xương dã ngoại bằng nẹp cành & băng tam giác.
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <svg className="w-3 h-3 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Thao tác nút dây neo SRT (Single Rope Technique) và hãm tụt vách đá an toàn.
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <svg className="w-3 h-3 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Mô phỏng tình huống sốc độ cao (AMS), hạ thân nhiệt & phương án sơ tán khẩn cấp.
              </li>
            </ul>
          </div>
          
          <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100">
            <div className="flex items-center gap-2 font-bold text-orange-900 text-sm mb-3">
              <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Lưu Ý Bắt Buộc Dành Cho Ứng Viên
            </div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <svg className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Trang bị giày trekking chuyên dụng có độ bám cao (Vibram hoặc tương đương).
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <svg className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Mang theo hộp sơ cứu cá nhân First-Aid Kit tiêu chuẩn và gậy leo núi.
              </li>
              <li className="flex items-start gap-2 text-xs text-gray-700">
                <svg className="w-3 h-3 text-orange-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                Trang phục dã ngoại gọn gàng, mang theo CCCD bản gốc để đối chiếu nhân thân.
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-4 border-t border-gray-100 gap-4">
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            Thông báo xác nhận đã được gửi tới email: <b>hung.nguyen@outdoor.vn</b>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-none px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Yêu cầu dời lịch
            </button>
            <button className="flex-1 md:flex-none px-6 py-2.5 bg-[#1B4332] hover:bg-[#153426] text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Xác nhận tham gia phỏng vấn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
