import React from 'react';

export const CreateRouteForm = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* VFRS Box */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-green-900">Quy chuẩn thẩm định an toàn VFRS</h3>
            <span className="bg-green-200 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded">Đủ điều kiện (4 Checkpoints)</span>
          </div>
          <p className="text-xs text-green-800">
            Tuyến đường hợp lệ cần tối thiểu 2 trạm dừng (checkpoints) bao gồm điểm xuất phát và điểm đích, có chỉ số độ cao vệ tinh và nguồn nước dự phòng rõ ràng.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            Thông tin cơ bản
          </h3>
          <span className="text-xs text-red-500">* Mục bắt buộc</span>
        </div>
        
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Tên cung đường <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              defaultValue="Tuyến Thác K5 - Rừng Nguyên Sinh Kon Chu Răng (Gia Lai)"
              className="w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332]"
            />
            <p className="text-[10px] text-gray-500 mt-1">Đặt tên theo cấu trúc: [Tên địa danh/Đỉnh] - [Khu vực/Tỉnh]</p>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Địa danh / Tỉnh thành <span className="text-red-500">*</span></label>
            <div className="relative">
              <input 
                type="text" 
                defaultValue="Khu BTTN Kon Chu Răng, Huyện K'Bang, Gia Lai"
                className="w-full border border-gray-200 rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] bg-blue-50/30"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-gray-700">Mô tả chi tiết hành trình <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-1 bg-gray-100 rounded px-1 py-0.5">
                <button className="p-1 hover:bg-white rounded"><span className="font-bold text-xs">B</span></button>
                <button className="p-1 hover:bg-white rounded"><span className="italic text-xs">I</span></button>
                <button className="p-1 hover:bg-white rounded">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                </button>
              </div>
            </div>
            <textarea 
              rows={4}
              defaultValue="Cung trekking xuyên qua vùng lõi rừng đặc dụng Tây Nguyên với thảm thực vật rêu phong cổ thụ và thác K5 hùng vĩ cao 50m. Tuyến đi yêu cầu kỹ năng lội suối và định vị GPS do tán rừng rậm rạp che khuất sóng viễn thông. Điểm xuất phát yêu cầu làm thủ tục tại Trạm Kiểm Lâm."
              className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] resize-none leading-relaxed"
            ></textarea>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">Độ khó tự đánh giá <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-4 gap-2">
              <button className="py-2 px-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">Dễ</button>
              <button className="py-2 px-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">Vừa phải</button>
              <button className="py-2 px-1 text-xs font-bold text-white bg-[#1B4332] border border-[#1B4332] rounded-lg shadow-sm">Thử thách</button>
              <button className="py-2 px-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">Chuyên gia</button>
            </div>
            <div className="mt-2 text-[10px] text-orange-600 bg-orange-50 p-2 rounded flex items-start gap-1">
              <svg className="w-3 h-3 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Cấp 3: Địa hình dốc liên tục, cần thể lực bền bỉ và kinh nghiệm vượt suối nước sâu.
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Khung thời gian lịch trình</label>
              <div className="relative">
                <input 
                  type="text" 
                  defaultValue="2 Ngày 1 Đêm"
                  className="w-full border border-gray-200 rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332]"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Giờ di chuyển thuần</label>
              <div className="relative">
                <input 
                  type="text" 
                  defaultValue="14 - 16 giờ leo"
                  className="w-full border border-gray-200 rounded-lg p-2.5 pl-9 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332]"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-bold text-blue-900">Đồng bộ dữ liệu số:</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-blue-800">
              <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> 18.5 km</span>
              <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> +890m / -760m</span>
              <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg> Max 1.050m</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Hình ảnh thực tế cung đường
          </h3>
          <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">3 ảnh đã tải</span>
        </div>
        <div className="p-5">
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer mb-4">
            <svg className="w-8 h-8 text-green-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <div className="text-sm font-bold text-gray-700">Kéo thả hoặc duyệt ảnh thực tế từ thiết bị</div>
            <div className="text-[10px] text-gray-500 mt-1">JPG, PNG, WebP có dữ liệu GPS EXIF tối đa 10MB/ảnh</div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="aspect-[4/3] rounded-lg overflow-hidden relative group">
              <img src="https://images.unsplash.com/photo-1432405972618-fc40814d2204?q=80&w=300&auto=format&fit=crop" className="w-full h-full object-cover" alt="Thác nước" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute bottom-2 left-2 text-white">
                <div className="text-[10px] font-medium opacity-80">Thác K5 cuối vực</div>
                <div className="text-[10px] font-bold uppercase">THÁC NƯỚC</div>
              </div>
            </div>
            <div className="aspect-[4/3] rounded-lg overflow-hidden relative group">
              <img src="https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=300&auto=format&fit=crop" className="w-full h-full object-cover" alt="Bãi lán" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute bottom-2 left-2 text-white">
                <div className="text-[10px] font-medium opacity-80">Bãi lán ven suối</div>
                <div className="text-[10px] font-bold uppercase">LÁN TRẠI</div>
              </div>
            </div>
            <div className="aspect-[4/3] rounded-lg overflow-hidden relative group">
              <img src="https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=300&auto=format&fit=crop" className="w-full h-full object-cover" alt="Rừng rêu" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute bottom-2 left-2 text-white">
                <div className="text-[10px] font-medium opacity-80">Rừng rêu nguyên sinh</div>
                <div className="text-[10px] font-bold uppercase">RỪNG GIÀ</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
