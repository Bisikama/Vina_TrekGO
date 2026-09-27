import React from 'react';

export const SidebarBenefits = () => {
  return (
    <div className="space-y-6">
      {/* Box 1 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded bg-yellow-50 text-yellow-600 flex items-center justify-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" /></svg>
          </div>
          <h3 className="font-bold text-gray-900">Quyền Lợi Leader PRO</h3>
          <span className="text-[10px] text-gray-400">Độc quyền dành riêng cho đoàn trưởng</span>
        </div>
        
        <div className="space-y-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <div className="text-sm font-bold text-gray-900">Thu nhập 1.2M - 3.5M / chuyến</div>
              <div className="text-[10px] text-gray-500">Áp dụng hành trình 2 ngày 1 đêm, thanh toán ngay sau tour</div>
            </div>
          </div>
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <div className="text-sm font-bold text-gray-900">Bảo hiểm dã ngoại 500 Triệu</div>
              <div className="text-[10px] text-gray-500">Tài trợ 100% bởi PICO cho mọi cung đường dẫn dắt</div>
            </div>
          </div>
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <div className="text-sm font-bold text-gray-900">Miễn phí thuê 100% trang bị</div>
              <div className="text-[10px] text-gray-500">Mượn lều, túi ngủ siêu nhẹ, bộ đàm và GPS Garmin</div>
            </div>
          </div>
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <div className="text-sm font-bold text-gray-900">Huy hiệu Leader PRO xác thực</div>
              <div className="text-[10px] text-gray-500">Tăng 350% độ tin cậy và số lượng thành viên đăng ký</div>
            </div>
          </div>
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <div className="text-sm font-bold text-gray-900">Huấn luyện nâng cao miễn phí</div>
              <div className="text-[10px] text-gray-500">Tham gia workshop chuyên gia quốc tế mỗi quý</div>
            </div>
          </div>
        </div>
      </div>

      {/* Box 2 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          Tiêu chí tối thiểu VFRS
        </h3>
        <ul className="space-y-3">
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Độ tuổi từ 21 tuổi trở lên
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Tối thiểu 3 năm kinh nghiệm trekking tự túc
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Có chứng nhận WFA còn hiệu lực
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Không có tiền sử bệnh tim mạch / hô hấp cấp
          </li>
        </ul>
      </div>

      {/* Box 3 */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
        <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          Cần trợ giúp nộp hồ sơ?
        </h3>
        <p className="text-xs text-blue-800 mb-4">
          Nếu bạn gặp sự cố khi tải tài liệu hoặc cần gia hạn nộp bổ sung chứng chỉ, liên hệ ngay với ban tuyển dụng:
        </p>
        <div className="space-y-2">
          <button className="w-full bg-white border border-blue-200 rounded-lg p-2.5 flex items-center justify-between hover:bg-blue-50 transition-colors">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              0988.771.234
            </div>
            <span className="text-[10px] text-gray-500">Phím số 5</span>
          </button>
          <button className="w-full bg-white border border-blue-200 rounded-lg p-2.5 flex items-center justify-between hover:bg-blue-50 transition-colors">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-600">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.84 1.46 5.37 3.75 7.03V22l3.43-1.89c.89.26 1.84.4 2.82.4 5.52 0 10-4.03 10-9s-4.48-9-10-9z" /></svg>
              Zalo Leader Support
            </div>
            <span className="text-[10px] text-gray-500">Phản hồi 5p</span>
          </button>
        </div>
      </div>
    </div>
  );
};
