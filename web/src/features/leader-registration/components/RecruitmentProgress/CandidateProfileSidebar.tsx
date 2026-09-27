import React from 'react';

export const CandidateProfileSidebar = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-[#1B4332] text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
          XÁC THỰC
        </div>
        
        <h3 className="font-bold text-gray-900 mb-6">Hồ Sơ Ứng Viên</h3>
        
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-3">
            <img src="https://images.unsplash.com/photo-1534447677768-be436bb09401?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80" alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md" />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>
          <div className="font-bold text-gray-900 text-lg">Nguyễn Hùng</div>
          <div className="text-[10px] text-gray-500">Thành viên từ 2018 • ID #VN-88421</div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-blue-900 mb-0.5">6 Năm</div>
            <div className="text-[10px] text-blue-700">Kinh nghiệm Trek</div>
          </div>
          <div className="bg-green-50/50 border border-green-100 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-900 mb-0.5">24 Cung</div>
            <div className="text-[10px] text-green-700">Chinh phục thành công</div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">TÀI LIỆU THẨM ĐỊNH</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2.5 rounded-lg">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white border border-gray-200 rounded text-gray-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">CV Dẫn đoàn dã ngoại</div>
                  <div className="text-[10px] text-gray-500">PDF • 2.4 MB</div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-900"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
            </div>
            
            <div className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2.5 rounded-lg">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white border border-gray-200 rounded text-green-500 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Bản sao CCCD gắn chip</div>
                  <div className="text-[10px] text-green-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>Đã đối chiếu VNeID</div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-900"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
            </div>
            
            <div className="flex justify-between items-center bg-gray-50 border border-gray-100 p-2.5 rounded-lg">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white border border-gray-200 rounded text-green-500 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Chứng chỉ Sơ cấp cứu WFA</div>
                  <div className="text-[10px] text-gray-500">Hiệu lực đến 11/2025</div>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-900"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          Ban Thư Ký Tuyển Dụng
        </h3>
        <p className="text-xs text-gray-500 mb-4">Hỗ trợ hồ sơ & điều phối lịch phỏng vấn</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2 text-sm text-gray-900">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              <div>
                <div className="font-bold">Đường dây nóng tuyển dụng</div>
                <div className="text-gray-500 font-medium">0988.771.234</div>
              </div>
            </div>
            <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded font-medium">8:00 - 18:00</span>
          </div>
          <div className="flex items-center justify-between pt-1 cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors">
            <div className="flex items-center gap-2 text-sm text-gray-900">
              <svg className="w-4 h-4 text-[#0068FF]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.84 1.46 5.37 3.75 7.03V22l3.43-1.89c.89.26 1.84.4 2.82.4 5.52 0 10-4.03 10-9s-4.48-9-10-9z" /></svg>
              <div>
                <div className="font-bold text-gray-600 text-xs">Kênh chat điều phối viên</div>
                <div className="font-bold">Zalo Leader Community</div>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Câu Hỏi Thường Gặp Về Leader
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg cursor-pointer">
            <span className="text-xs font-bold text-gray-700">Quyền lợi khi trở thành Leader PRO?</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg cursor-pointer">
            <span className="text-xs font-bold text-gray-700">Chính sách phụ cấp dẫn đoàn?</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
          <div className="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg cursor-pointer">
            <span className="text-xs font-bold text-gray-700">Quy trình kích hoạt bảo hiểm?</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
};
