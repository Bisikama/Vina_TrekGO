'use client';
import React, { useState } from 'react';

export const DocumentSection = ({ onUploadComplete, isUploaded }: { onUploadComplete?: () => void, isUploaded?: boolean }) => {
  return (
    <div className="bg-[#F8FBFA] rounded-xl shadow-sm border border-[#E8F3EF] p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#1B4332] text-white flex items-center justify-center font-bold text-sm">3</div>
          <div>
            <h3 className="font-bold text-[#1B4332] text-lg">Tài liệu pháp lý & Hồ sơ bắt buộc</h3>
            <p className="text-xs text-gray-500">Hỗ trợ file PDF, JPG, PNG tối đa 20MB. Yêu cầu ảnh chụp rõ nét 4 góc.</p>
          </div>
        </div>
        <div className="text-xs font-medium text-gray-500 flex items-center gap-1 bg-white px-2 py-1 rounded border border-gray-200">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          Mã hóa an toàn 256-bit
        </div>
      </div>

      <div className="space-y-4">
        {/* Document 1 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="font-bold text-sm text-gray-900">1. Hồ sơ năng lực / CV Trekking Leader</span>
              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">BẮT BUỘC</span>
            </div>
            <div className="text-[10px] font-medium text-green-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Đã tải lên
            </div>
          </div>
          <div className="flex items-center justify-between bg-gray-50/50 rounded-lg p-3 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 text-red-600 rounded flex items-center justify-center font-bold text-xs">PDF</div>
              <div>
                <div className="text-sm font-bold text-gray-900">CV_NguyenHung_Trekker_Leader_2024.pdf</div>
                <div className="text-[10px] text-gray-500">2.4 MB • Cập nhật ngày 14/10/2024</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-md bg-white">Xem trước</button>
              <button className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 border border-gray-200 rounded-md bg-white">Thay thế</button>
              <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-md border border-red-100"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
          </div>
        </div>

        {/* Document 2 */}
        <div className={`bg-white rounded-xl border ${isUploaded ? 'border-gray-200' : 'border-red-200 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'} p-4`}>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
              <span className="font-bold text-sm text-gray-900">2. Căn cước công dân / Hộ chiếu (2 mặt)</span>
              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">BẮT BUỘC</span>
            </div>
            {!isUploaded && (
              <div className="text-[10px] font-medium text-red-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Thiếu mặt sau
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between bg-gray-50/50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded flex items-center justify-center font-bold text-xs">JPG</div>
                <div>
                  <div className="text-sm font-bold text-gray-900">CCCD_NguyenHung_MatTruoc.jpg</div>
                  <div className="text-[10px] text-gray-500">1.6 MB • Mặt trước</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
              </div>
            </div>
            
            {isUploaded ? (
              <div className="flex items-center justify-between bg-gray-50/50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded flex items-center justify-center font-bold text-xs">JPG</div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">CCCD_NguyenHung_MatSau.jpg</div>
                    <div className="text-[10px] text-gray-500">1.2 MB • Mặt sau</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                  <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-md"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div>
              </div>
            ) : (
              <div onClick={onUploadComplete} className="border-2 border-dashed border-red-200 bg-red-50/30 rounded-lg p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-red-50/50 transition-colors">
                <svg className="w-6 h-6 text-red-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <div className="text-xs font-bold text-red-600">Chưa tải CCCD mặt sau</div>
                <div className="text-[10px] text-gray-500 mb-2">Kéo thả hoặc nhấp để tải ảnh lên</div>
                <button className="bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-md hover:bg-red-700 transition-colors">+ Tải mặt sau</button>
              </div>
            )}
          </div>
        </div>

        {/* Document 3 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="font-bold text-sm text-gray-900">3. Chứng chỉ Sơ cấp cứu (WFA) & Kỹ năng</span>
              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded">BẮT BUỘC</span>
            </div>
            <div className="text-[10px] font-medium text-green-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Đã nộp 2 tệp
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-gray-50/50 rounded-lg p-2.5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-50 text-red-600 rounded flex items-center justify-center font-bold text-[10px]">PDF</div>
                <div>
                  <div className="text-xs font-bold text-gray-900">WFA_Survival_Certificate_IREC_2023.pdf</div>
                  <div className="text-[10px] text-gray-500">3.1 MB • Cấp bởi IREC International</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="text-[10px] font-medium text-gray-600 hover:text-gray-900 px-2 py-1 border border-gray-200 rounded bg-white">Xem</button>
                <button className="p-1 text-red-500 hover:bg-red-50 rounded border border-red-100"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
              </div>
            </div>
            
            <div className="flex items-center justify-between bg-gray-50/50 rounded-lg p-2.5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-50 text-red-600 rounded flex items-center justify-center font-bold text-[10px]">PDF</div>
                <div>
                  <div className="text-xs font-bold text-gray-900">GPS_Wilderness_Navigation_VFRS.pdf</div>
                  <div className="text-[10px] text-gray-500">1.5 MB • Cấp bởi Hiệp hội VFRS</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="text-[10px] font-medium text-gray-600 hover:text-gray-900 px-2 py-1 border border-gray-200 rounded bg-white">Xem</button>
                <button className="p-1 text-red-500 hover:bg-red-50 rounded border border-red-100"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
              </div>
            </div>
          </div>
          
          <button className="w-full mt-3 py-2.5 border border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Đính kèm thêm bằng cấp hoặc giấy khen khác
          </button>
        </div>
      </div>
    </div>
  );
};
