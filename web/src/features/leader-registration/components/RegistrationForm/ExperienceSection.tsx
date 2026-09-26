'use client';
import React, { useState } from 'react';

export const ExperienceSection = () => {
  const [bio, setBio] = useState('Tôi là một trekker đam mê thiên nhiên với triết lý "An toàn là danh dự của người dẫn đường". Với 6 năm lặn lội qua các cung đường Tây Bắc và Tây Nguyên, tôi đặc biệt chú trọng kỹ năng sinh tồn tự nhiên, đọc thời tiết sương mù và giữ vững nhịp tim/thể lực đồng đều cho từng thành viên trong đoàn. Tôi luôn dự phòng các phương án rủi ro nước lũ, sạt lở và mang đầy đủ thiết bị y tế khẩn cấp, đảm bảo mỗi thành viên không chỉ chinh phục đỉnh cao mà còn trở về bình an trọn vẹn.');
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gray-100 text-gray-700 flex items-center justify-center font-bold text-sm">1</div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Kinh nghiệm leo núi & Dẫn đoàn</h3>
            <p className="text-xs text-gray-500">Dữ liệu tổng hợp từ các chuyến đi đã hoàn thành trên hệ thống</p>
          </div>
        </div>
        <button className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          Chỉnh sửa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10">
            <svg className="w-24 h-24 text-blue-900" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 12h3v9h6v-6h4v6h6v-9h3L12 2z" /></svg>
          </div>
          <div className="text-[10px] font-bold text-blue-800 uppercase mb-1">Thời gian hoạt động</div>
          <div className="text-2xl font-extrabold text-blue-900 mb-1">6 năm kinh nghiệm</div>
          <div className="text-xs text-blue-700">Đã dẫn hơn 36 lượt đoàn an toàn tuyệt đối</div>
        </div>
        <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-10">
            <svg className="w-24 h-24 text-green-900" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div className="text-[10px] font-bold text-green-800 uppercase mb-1">Cung đường đã chinh phục</div>
          <div className="text-2xl font-extrabold text-green-900 mb-1">24 cung đường & Đỉnh núi</div>
          <div className="text-xs text-green-700">Fansipan, Tà Xùa, Pu Ta Leng, Bidoup, Lảo Thẩn ...</div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
          <label className="text-sm font-bold text-gray-900">Tự giới thiệu bản thân & Phong cách dẫn đoàn (Bio)</label>
          <span className="text-[10px] text-gray-400">Đã lưu nháp</span>
        </div>
        <textarea 
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] min-h-[120px] resize-none bg-gray-50/50 text-gray-700 leading-relaxed"
        ></textarea>
      </div>

      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-bold text-gray-900">Ảnh chụp hành trình thực tế trong quá khứ (4 ảnh minh chứng thực địa)</label>
          <button className="text-xs font-medium text-[#1B4332] hover:underline flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Thêm ảnh
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative rounded-lg overflow-hidden h-24 group cursor-pointer">
            <img src="https://images.unsplash.com/photo-1522163182402-834f871fd851?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Tà Xùa" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2">
              <span className="text-white text-[10px] font-bold">Tà Xùa săn mây</span>
            </div>
          </div>
          <div className="relative rounded-lg overflow-hidden h-24 group cursor-pointer">
            <img src="https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Pu Ta Leng" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2">
              <span className="text-white text-[10px] font-bold">Pu Ta Leng đỗ quyên</span>
            </div>
          </div>
          <div className="relative rounded-lg overflow-hidden h-24 group cursor-pointer">
            <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="KCR" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2">
              <span className="text-white text-[10px] font-bold">Rừng Kon Chu Răng</span>
            </div>
          </div>
          <div className="relative rounded-lg overflow-hidden h-24 group cursor-pointer">
            <img src="https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Vượt suối" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-2">
              <span className="text-white text-[10px] font-bold">Vượt ghềnh vách đá</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
