import React from 'react';

export const MediaUpload = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-[#1B4332]"></div>
      
      <div className="flex items-start gap-4 mb-6">
        <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center font-bold text-sm shrink-0">4</div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">Album Hình Ảnh & Video Của Bạn</h3>
          <p className="text-sm text-gray-500 mt-1">Đóng góp khoảnh khắc đẹp để truyền cảm hứng cho cộng đồng (Tối đa 10 ảnh/video, 25MB/file).</p>
        </div>
      </div>
      
      <div className="ml-0 md:ml-12">
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer group">
          <div className="bg-white p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </div>
          <div className="font-bold text-gray-900">Bấm để chọn file hoặc kéo thả vào đây</div>
          <div className="text-xs text-gray-500 mt-1">Hỗ trợ JPG, PNG, MP4. File chất lượng cao sẽ được giữ nguyên (Lossless).</div>
        </div>
        
        <div className="flex items-center gap-2 mt-4 text-xs font-medium text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-100 w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v1m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Tải lên ảnh có mặt Leader hướng dẫn hoặc sử dụng đồ kho để được x1.5 Điểm thưởng VFRS!
        </div>
      </div>
    </div>
  );
};
