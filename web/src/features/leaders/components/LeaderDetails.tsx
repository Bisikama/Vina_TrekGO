"use client";

import React from 'react';
import Link from 'next/link';

export const LeaderDetails = ({ id }: { id: string }) => {
  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center text-sm text-gray-500 mb-4 gap-1.5 font-medium">
          <Link href="/admin/leaders" className="hover:text-emerald-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Quay lại danh sách hồ sơ
          </Link>
          <span>/</span>
          <span>Quản trị hệ thống</span>
          <span>/</span>
          <span>Quản lý Leader</span>
          <span>/</span>
          <span className="text-gray-900">#APPL-{id}</span>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded-md border border-blue-100">#APPL-{id}</span>
              <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded-md border border-emerald-100 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Khu vực: Tây Bắc (Hoàng Liên Sơn & Tà Xùa)
              </span>
              <span className="bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1 rounded-md border border-orange-100 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                Giai đoạn 4 - Đánh giá Phỏng vấn
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Chi tiết Hồ sơ Ứng tuyển: Hoàng Thu Trang</h1>
            <p className="text-gray-500 text-sm">Nộp hồ sơ: 20/10/2024 lúc 14:32 • Cập nhật gần nhất bởi Super Admin: 25/10/2024 16:45</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Xuất phiếu thẩm định PDF
            </button>
            <button className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2 shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Lịch sử trao đổi / Log
            </button>
            <button className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 flex items-center gap-2 shadow-sm transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Từ chối hồ sơ
            </button>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Tiến trình xét duyệt 5 giai đoạn VFRS LEADER TRACK</h3>
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">HOÀN THÀNH 3/5 BƯỚC (70%)</span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {/* Stage 1 */}
          <div className="bg-white border-2 border-emerald-500 rounded-xl p-4 shadow-sm relative">
            <div className="flex justify-between items-center mb-2">
              <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Đã duyệt</span>
            </div>
            <div className="font-bold text-sm text-gray-900 mb-1">1. Thẩm định hồ sơ</div>
            <div className="text-xs text-gray-500">Admin Khoa • 24/10/2024</div>
            <div className="absolute right-0 top-1/2 -mt-px w-3 h-0.5 bg-emerald-500 translate-x-full z-10"></div>
          </div>
          {/* Stage 2 */}
          <div className="bg-white border-2 border-emerald-500 rounded-xl p-4 shadow-sm relative">
            <div className="flex justify-between items-center mb-2">
              <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Đạt (93%)</span>
            </div>
            <div className="font-bold text-sm text-gray-900 mb-1">2. Bài thi trực tuyến</div>
            <div className="text-xs text-gray-500">93.3% An toàn & Sơ cứu</div>
            <div className="absolute right-0 top-1/2 -mt-px w-3 h-0.5 bg-emerald-500 translate-x-full z-10"></div>
          </div>
          {/* Stage 3 */}
          <div className="bg-white border-2 border-emerald-500 rounded-xl p-4 shadow-sm relative">
            <div className="flex justify-between items-center mb-2">
              <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase">Đã phỏng vấn</span>
            </div>
            <div className="font-bold text-sm text-gray-900 mb-1">3. Lên lịch thực địa</div>
            <div className="text-xs text-gray-500">26/10 tại Sa Pa VFRS</div>
            <div className="absolute right-0 top-1/2 -mt-px w-3 h-0.5 bg-emerald-500 translate-x-full z-10"></div>
          </div>
          {/* Stage 4 */}
          <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-4 shadow-sm relative">
            <div className="flex justify-between items-center mb-2">
              <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
              <span className="text-[10px] font-bold text-orange-600 uppercase flex items-center gap-1">
                 <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div> Đang thực hiện
              </span>
            </div>
            <div className="font-bold text-sm text-orange-900 mb-1">4. Nhập kết quả</div>
            <div className="text-xs text-orange-700">92/100 • Hoàn tất biên bản</div>
            <div className="absolute right-0 top-1/2 -mt-px w-3 h-0.5 bg-gray-200 translate-x-full z-10"></div>
          </div>
          {/* Stage 5 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 border-dashed">
            <div className="flex justify-between items-center mb-2">
              <div className="w-6 h-6 bg-gray-200 text-gray-500 rounded-full flex items-center justify-center text-xs font-bold">5</div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Chờ duyệt</span>
            </div>
            <div className="font-bold text-sm text-gray-400 mb-1">5. Phê duyệt & Cấp thẻ</div>
            <div className="text-xs text-gray-400">Cấp mã thẻ VFRS Pro</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-5 space-y-6">
          {/* Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Thông tin Ứng viên & Thể chất
              </h3>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                VNeID Mức 2
              </span>
            </div>
            <div className="flex gap-4 mb-5 pb-5 border-b border-gray-100">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop" alt="Hoàng Thu Trang" className="w-16 h-16 rounded-xl object-cover shadow-sm" />
              <div>
                <h4 className="font-bold text-lg text-gray-900 leading-tight mb-1">Hoàng Thu Trang</h4>
                <div className="text-xs text-gray-600 mb-1">Nữ • 1993 (31 tuổi) • CCCD: <strong>00119300****</strong></div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Phường Sa Pa, Thị xã Sa Pa, Tỉnh Lào Cai
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Điện thoại</div>
                <div className="font-bold text-sm text-gray-900">0982 849 xxx</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Email nghiệp vụ</div>
                <div className="font-bold text-sm text-gray-900 truncate">trang.hoang...</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Thể lực y khoa</div>
                <div className="font-bold text-sm text-gray-900">Hạng A1 (Gắng sức 2024)</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Huyết áp / Nhịp tim</div>
                <div className="font-bold text-sm text-gray-900">115/75 mmHg<br/><span className="text-gray-500 text-xs font-medium">• 58 bpm</span></div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border border-red-100 col-span-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-red-600 uppercase font-bold mb-0.5">Nhóm máu</div>
                  <div className="font-bold text-red-700 flex items-center gap-1">
                     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                     O+ (Kháng thể chuẩn)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-red-600 uppercase font-bold mb-0.5">Liên hệ khẩn cấp</div>
                  <div className="font-bold text-red-700">H.V.Nam [Anh: 0912 345 xxx]</div>
                </div>
              </div>
            </div>
          </div>

          {/* Experience */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Kinh nghiệm Dẫn đoàn & Thực địa
              </h3>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">Thâm niên: 5+ năm</span>
            </div>
            
            <div className="flex divide-x divide-gray-100 mb-5 border border-gray-100 rounded-lg p-3 bg-gray-50">
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-emerald-600 mb-1">42</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase">Chuyến dẫn độc lập</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">18</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase">Chuyến phó đoàn Trek</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-purple-600 mb-1">3,143m</div>
                <div className="text-[10px] font-bold text-gray-500 uppercase">Độ cao cực đại (Fansipan)</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold text-gray-900 mb-2">Cung đường thành thạo (Đã thẩm định GPX):</div>
              <div className="flex flex-wrap gap-2">
                <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded border border-gray-200">Fansipan (Trạm Tôn & Cát Cát)</span>
                <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded border border-gray-200">Kỳ Quan San (Bạch Mộc Lương Tử)</span>
                <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded border border-gray-200">Lảo Thẩn & Y Tý</span>
                <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded border border-gray-200">Tà Xùa (Sống lưng Khủng long)</span>
                <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1.5 rounded border border-gray-200">Nhìu Cồ San</span>
              </div>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <div className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                 Kỹ năng chuyên sâu ghi nhận:
              </div>
              <ul className="text-xs text-blue-800 space-y-2 list-disc list-inside">
                <li>Điều hướng thiết bị vệ tinh Garmin inReach & phân tích bình đồ bản đồ quân sự WGS84.</li>
                <li>Xử lý sự cố sốc độ cao cấp tính (AMS) và chống hạ thân nhiệt trong thời tiết đóng băng.</li>
                <li>Kỹ thuật dây neo cứu trợ vượt suối lũ và địa hình vách đá trơn trượt Hoàng Liên Sơn.</li>
              </ul>
            </div>
          </div>

          {/* Certifications */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                Chứng chỉ Chuyên môn & Giám định Scan
              </h3>
              <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-1 rounded-full">3/3 HỢP LỆ</span>
            </div>

            <div className="space-y-3">
              <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/30">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-emerald-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    <div>
                      <div className="font-bold text-sm text-gray-900">Wilderness First Aid (WFA) - Cứu hộ Dã ngoại</div>
                      <div className="text-xs text-gray-500">Cấp bởi: Wilderness Medical Institute</div>
                      <div className="text-xs text-gray-500">• Thời hạn: 2023 - 2026</div>
                    </div>
                  </div>
                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">Đã xác thực</span>
                </div>
                <div className="mt-3 flex gap-3 bg-white p-2 rounded border border-emerald-100">
                  <div className="w-24 h-16 bg-gray-200 rounded border border-gray-300 overflow-hidden shrink-0">
                    <img src="https://images.unsplash.com/photo-1605639735492-3bc344df3c59?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover opacity-80" alt="Certificate" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900 mb-1">Mã số: WFA-VN-98421 <svg className="inline w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                    <div className="text-[10px] text-gray-600 leading-tight mb-1">Dấu mộc do viện y học thể thao được xác nhận qua cổng tra cứu quốc tế.</div>
                    <button className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Mở bản scan độ phân giải cao
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                  <div>
                    <div className="font-bold text-sm text-gray-900">Thẻ Hướng dẫn viên Leo núi VFRS Quốc gia</div>
                    <div className="text-[11px] text-gray-500">Cục TCDT & Hiệp hội Leo núi Việt Nam</div>
                  </div>
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded border border-emerald-200 uppercase">Hợp lệ</span>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <div>
                    <div className="font-bold text-sm text-gray-900">Giấy khám sức khỏe Leo núi độ cao (&gt;3000m)</div>
                    <div className="text-[11px] text-gray-500">Bệnh viện Đa khoa Tỉnh Lào Cai (Cấp 12/10/2024)</div>
                  </div>
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded border border-emerald-200 uppercase">Hợp lệ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-7 space-y-6">
          <div className="bg-white border-2 border-emerald-500 rounded-xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-bl-lg flex items-center gap-1 shadow-sm">
               <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
               ĐIỂM THỰC ĐỊA TỔNG HỢP: XUẤT SẮC (TIÊU CHUẨN A)
            </div>
            
            <div className="p-6">
              {/* Stage 1 & 2 */}
              <div className="relative pl-8 pb-6 border-l-2 border-emerald-200 ml-4">
                <div className="absolute -left-[17px] top-0 w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold border-2 border-emerald-500 shadow-sm">1</div>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-gray-900 text-[15px]">Giai đoạn 1: Thẩm định hồ sơ ban đầu</h4>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Đã duyệt hợp lệ</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs text-gray-700 leading-relaxed mb-2">
                  <strong>Biên nhận kiểm duyệt:</strong> "Hồ sơ CCCD, giấy chứng nhận y khoa Leo núi chuyên biệt và phiếu Lý lịch tư pháp số 2 hoàn toàn sạch, công chứng đầy đủ. Khả dụng cho bài thi trắc nghiệm nghiệp vụ."
                </div>
                <div className="text-[10px] text-gray-400">Kiểm định viên: Trần Đăng Khoa • 24/10/2024 10:15</div>
              </div>

              <div className="relative pl-8 pb-6 border-l-2 border-emerald-200 ml-4">
                <div className="absolute -left-[17px] top-0 w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold border-2 border-emerald-500 shadow-sm">2</div>
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-gray-900 text-[15px]">Giai đoạn 2: Kết quả Bài thi Trắc nghiệm An toàn</h4>
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">ĐẠT (93.3%)</span>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-2">
                  <div className="border border-gray-200 rounded-lg p-3 text-center bg-white shadow-sm">
                    <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Cứu hộ & GPS</div>
                    <div className="font-bold text-lg text-emerald-600">10 <span className="text-sm text-gray-400">/ 10</span></div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3 text-center bg-white shadow-sm">
                    <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Sơ cấp cứu WFA</div>
                    <div className="font-bold text-lg text-gray-900">9 <span className="text-sm text-gray-400">/ 10</span></div>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3 text-center bg-white shadow-sm">
                    <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Quy tắc ứng xử VFRS</div>
                    <div className="font-bold text-lg text-gray-900">9 <span className="text-sm text-gray-400">/ 10</span></div>
                  </div>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500 px-1">
                  <span>Tổng số: <strong>28 / 30 câu đúng</strong> (Yêu cầu tối thiểu: 24/30)</span>
                  <span>Thời gian làm bài: 22 phút 15 giây</span>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="relative pl-8 pb-6 border-l-2 border-emerald-200 ml-4">
                <div className="absolute -left-[17px] top-0 w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold border-2 border-emerald-500 shadow-sm">3</div>
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-gray-900 text-[15px]">Giai đoạn 3: Phỏng vấn & Sát hạch Thực địa</h4>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Hoàn tất thực địa</span>
                </div>
                
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <div><span className="font-bold text-gray-700">Thời gian:</span> 25/10/2024 (08:30 - 15:00)</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <div><span className="font-bold text-gray-700">Địa điểm:</span> Trạm điều hành cứu hộ VFRS Sa Pa (Khu B Vườn Quốc Gia Hoàng Liên)</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    <div><span className="font-bold text-gray-700">Hội đồng khảo thí:</span> Thầy Nguyễn Đình Quân (Chuyên gia Sinh tồn) & Admin Trần Đăng Khoa</div>
                  </div>
                </div>
              </div>

              {/* Stage 4 */}
              <div className="relative pl-8 pb-6 border-l-2 border-orange-200 ml-4">
                <div className="absolute -left-[17px] top-0 w-8 h-8 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center font-bold border-2 border-orange-500 shadow-sm relative">
                  4
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full animate-ping"></div>
                </div>
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-bold text-gray-900 text-[15px]">Giai đoạn 4: Nhập kết quả & Biên bản Thực địa</h4>
                  <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Đang nhập dữ liệu</span>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-blue-700 mb-1 uppercase h-6">Xử lý lạc đường & GPS</div>
                    <div className="font-bold text-xl text-blue-900">9.5 <span className="text-xs text-blue-500 font-medium">/ 10</span></div>
                    <div className="text-[10px] text-blue-600 mt-1">Định vị nhanh & chuẩn</div>
                  </div>
                  <div className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-emerald-700 mb-1 uppercase h-6">Dựng lán & Sơ cứu gãy</div>
                    <div className="font-bold text-xl text-emerald-900">9.0 <span className="text-xs text-emerald-500 font-medium">/ 10</span></div>
                    <div className="text-[10px] text-emerald-600 mt-1">Cố định nẹp chuẩn WFA</div>
                  </div>
                  <div className="border border-purple-100 bg-purple-50/30 rounded-lg p-3">
                    <div className="text-[10px] font-bold text-purple-700 mb-1 uppercase h-6">Tác phong điều phối</div>
                    <div className="font-bold text-xl text-purple-900">9.0 <span className="text-xs text-purple-500 font-medium">/ 10</span></div>
                    <div className="text-[10px] text-purple-600 mt-1">Bình tĩnh, truyền cảm hứng</div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-gray-900 text-white rounded-lg p-4 shadow-md">
                   <div className="font-bold text-sm">Tổng điểm sát hạch thực địa:</div>
                   <div className="text-2xl font-black text-emerald-400">92 / 100 điểm</div>
                </div>

                <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-[11px] font-bold text-gray-600 uppercase mb-2 tracking-wider">Ghi chú chính thức của Hội đồng Sát hạch:</div>
                  <p className="text-sm text-gray-800 italic leading-relaxed">
                    "Ứng viên Hoàng Thu Trang thể hiện tác phong điềm tĩnh vượt trội trong bài tập mô phỏng giông lốc đột ngột ở độ cao 2.400m. Phân xạ sơ cứu gãy kín cẳng chân hoàn tất trong 4 phút 10 giây. Kỹ năng vận hành bộ đàm và tín hiệu vệ tinh VFRS cực kỳ thuần thục. Đề xuất cấp thẻ Mountain Leader chính thức."
                  </p>
                </div>
              </div>

              {/* Stage 5 */}
              <div className="relative pl-8 ml-4">
                <div className="absolute -left-[17px] top-0 w-8 h-8 bg-white text-gray-400 rounded-full flex items-center justify-center font-bold border-2 border-gray-200 shadow-sm">5</div>
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-gray-900 text-[15px]">Giai đoạn 5: Bảng Ra Quyết Định Phê Duyệt</h4>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-indigo-200">Quyền Super Admin</span>
                </div>
                
                <div className="bg-white border-2 border-emerald-100 rounded-xl p-5">
                  <div className="space-y-3 mb-5">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                      <div>
                        <div className="font-bold text-sm text-gray-900">Cấp thẻ Mountain Leader Chính thức (PRO VFRS)</div>
                        <div className="text-xs text-gray-500">Kích hoạt tài khoản dẫn đoàn trên ứng dụng Mobile Ops</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                      <div>
                        <div className="font-bold text-sm text-gray-900">Gán phân vùng giám sát: Tây Bắc (Tỉnh Lào Cai & Sơn La)</div>
                        <div className="text-xs text-gray-500">Ủy quyền ứng cứu sự cố tại dải sơn Hoàng Liên Sơn</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-1 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                      <div>
                        <div className="font-bold text-sm text-gray-900">Cấp quyền tạo Chuyến đi công khai (Public Expeditions)</div>
                        <div className="text-xs text-gray-500">Cho phép mở booking thương mại không cần kiểm duyệt từng chuyến</div>
                      </div>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Mã số thẻ Leader dự kiến:</div>
                      <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold text-gray-900 text-center tracking-widest">
                        ML-TB-2024-049
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Thời hạn cấp thẻ:</div>
                      <select className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                        <option>3 Năm (Đến 26/10/2027)</option>
                        <option>1 Năm</option>
                        <option>5 Năm</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Lý do phê duyệt / Căn cứ quyết định:</div>
                    <textarea className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 h-20 resize-none" defaultValue="Ứng viên đáp ứng vượt chuẩn mọi bài kiểm tra sát hạch và phỏng vấn. Kinh nghiệm dày dặn tại khu vực Tây Bắc." />
                  </div>

                  <div className="flex gap-3">
                    <button className="flex-1 py-3 bg-[#1B5E41] hover:bg-[#144a33] text-white text-sm font-bold rounded-lg shadow-md transition-colors flex justify-center items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Phê duyệt & Cấp thẻ Mountain Leader
                    </button>
                    <button className="w-32 py-3 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-bold rounded-lg transition-colors flex justify-center items-center gap-1.5 border border-red-200">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      Từ chối
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
