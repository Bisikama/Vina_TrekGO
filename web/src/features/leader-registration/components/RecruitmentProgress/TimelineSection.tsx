import React from 'react';

export const TimelineSection = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex justify-between items-center mb-8">
        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Quy Trình Sát Hạch 5 Giai Đoạn
        </h3>
        <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-lg">Đang hoàn thành: 3/5 bước</span>
      </div>

      <div className="relative border-l-2 border-green-200 ml-4 space-y-8 pb-4">
        {/* Step 1: Done */}
        <div className="relative pl-8">
          <div className="absolute -left-[17px] top-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex justify-between items-start mb-1">
            <div className="font-bold text-gray-900">1. Nộp hồ sơ (Dossier Submitted)</div>
            <div className="text-xs text-gray-500 font-medium">14/11/2024 09:30</div>
          </div>
          <div className="text-sm text-gray-600 mb-2">Hồ sơ năng lực trực tuyến đã được mã hóa và tiếp nhận vào hệ thống điều phối VFRS.</div>
          <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-600 px-2 py-1 rounded text-[10px] font-medium">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            Đã đính kèm 3 tệp chứng chỉ
          </div>
        </div>

        {/* Step 2: Done */}
        <div className="relative pl-8">
          <div className="absolute -left-[17px] top-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex justify-between items-start mb-1">
            <div className="font-bold text-gray-900">2. Thẩm định hồ sơ (Dossier Review)</div>
            <div className="text-xs text-gray-500 font-medium">15/11/2024 16:45</div>
          </div>
          <div className="text-sm text-gray-600 mb-2">Đạt chuẩn 6 năm kinh nghiệm & chứng chỉ WFA quốc tế. Lịch sử dẫn đoàn an toàn không có sự cố mức độ 2+.</div>
          <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-medium">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Thẩm định viên: Trưởng Ban Tùng (VFRS Safety Board)
          </div>
        </div>

        {/* Step 3: Done */}
        <div className="relative pl-8">
          <div className="absolute -left-[17px] top-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex justify-between items-start mb-1">
            <div className="font-bold text-gray-900">3. Thi trắc nghiệm an toàn (Online Test)</div>
            <div className="text-xs text-gray-500 font-medium">18/11/2024 20:15</div>
          </div>
          <div className="text-sm text-gray-600 mb-2">Hoàn thành bài thi trực tuyến chuyên đề Khí tượng núi cao & Xử lý chấn thương thực địa.</div>
          <div className="inline-flex items-center gap-1.5 bg-[#D4A373]/10 border border-[#D4A373]/30 text-[#B3875B] px-2 py-1 rounded text-[10px] font-bold">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1zm-5 8.274l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L5 10.274zm10 0l-.818 2.552c.25.112.526.174.818.174.292 0 .569-.062.818-.174L15 10.274z" clipRule="evenodd" /></svg>
            Điểm: 28/30 câu (93.3%) — XUẤT SẮC
          </div>
        </div>

        {/* Step 4: Current */}
        <div className="relative pl-8 bg-orange-50/50 -mx-6 px-6 py-4 rounded-xl border border-orange-100 shadow-sm mt-2 mb-2">
          <div className="absolute -left-[17px] top-5 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <div className="flex justify-between items-start mb-1">
            <div className="font-bold text-orange-900 flex items-center gap-2">
              4. Phỏng vấn thực địa & Đánh giá năng lực
              <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">ĐANG DIỄN RA</span>
            </div>
            <div className="text-xs text-orange-800 font-bold">23/11/2024 08:30</div>
          </div>
          <div className="text-sm text-gray-700">Khảo sát kỹ năng cứu hộ trực tiếp tại Vườn Quốc Gia Ba Vì cùng Hội đồng Chuyên gia VFRS.</div>
        </div>

        {/* Step 5: Future */}
        <div className="relative pl-8 pt-2">
          <div className="absolute -left-[17px] top-3 w-8 h-8 bg-white border-4 border-gray-200 rounded-full flex items-center justify-center z-10">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="flex justify-between items-start mb-1 opacity-60">
            <div className="font-bold text-gray-700 flex items-center gap-2">
              5. Ra quyết định & Ký hợp đồng Dẫn đoàn
              <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200">CHỜ DUYỆT</span>
            </div>
            <div className="text-xs text-gray-400 font-medium">Dự kiến 25/11/2024</div>
          </div>
          <div className="text-sm text-gray-500 opacity-60">Phê duyệt hạn ngạch Leader PRO, cấp mã định danh số và ký thỏa thuận quy tắc an toàn bảo hiểm.</div>
        </div>
      </div>
    </div>
  );
};
