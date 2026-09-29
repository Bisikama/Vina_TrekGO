import React from 'react';

export const VFRSTestChecklist = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Checklist Tiêu Chuẩn Thẩm Định VFRS</h3>
          <p className="text-sm text-gray-500 mt-0.5">Quy chuẩn thẩm định an toàn được kiểm tra tự động trước khi chuyển giao Ban Thẩm Định</p>
        </div>
        <div className="bg-green-50 text-green-700 font-bold px-3 py-1.5 rounded-lg flex items-center gap-2 border border-green-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Đủ điều kiện gửi thẩm định (4/4 Tiêu chuẩn VFRS)
        </div>
      </div>
      
      <div className="divide-y divide-gray-100">
        {/* Item 1 */}
        <div className="p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-gray-900 text-base">Tính hợp lệ của Tracklog & Lộ trình (Route Valid)</h4>
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">100% PASS</span>
            </div>
            <p className="text-sm text-gray-600">Đạt chuẩn HDOP 1.2, đầy đủ 1.420 điểm tọa độ GPS liên tục, không xuất hiện điểm nhảy vọt tín hiệu (teleportation drift).</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-sm font-semibold text-gray-700">1.420 / 1.420 GPS Pts</div>
            <button className="text-sm font-medium text-gray-500 hover:text-gray-900">Chi tiết</button>
          </div>
        </div>

        {/* Item 2 */}
        <div className="p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-gray-900 text-base">Hệ thống Trạm dừng (Checkpoints Complete)</h4>
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">4 / 4 TRẠM</span>
            </div>
            <p className="text-sm text-gray-600">Đạt chuẩn 4 trạm quy định: Trạm Kiểm Lâm (Bắt đầu) • Suối Đá Trắng (Nguồn nước) • Bãi Lán K5 (Hạ trại) • Buôn Lưới (Cửa rừng ra).</p>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-green-600 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Toàn vẹn tọa độ
          </div>
        </div>

        {/* Item 3 */}
        <div className="p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors">
          <div className="w-8 h-8 rounded-full bg-[#1B4332] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-gray-900 text-base">Hình ảnh thực địa & GPS EXIF (Photos Added)</h4>
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">3 ẢNH GỐC</span>
            </div>
            <p className="text-sm text-gray-600">Đã nạp 3 ảnh chụp thực địa có gắn thẻ Geotag EXIF nguyên bản xác thực quang cảnh thực tế tại các điểm rẽ hiểm trở.</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex -space-x-2">
              <img src="https://images.unsplash.com/photo-1432405972618-fc40814d2204?q=80&w=100&auto=format&fit=crop" className="w-8 h-8 rounded border-2 border-white shadow-sm" alt="Pic1" />
              <img src="https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=100&auto=format&fit=crop" className="w-8 h-8 rounded border-2 border-white shadow-sm" alt="Pic2" />
              <img src="https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=100&auto=format&fit=crop" className="w-8 h-8 rounded border-2 border-white shadow-sm" alt="Pic3" />
            </div>
          </div>
        </div>

        {/* Item 4 */}
        <div className="p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors bg-orange-50/30">
          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-gray-900 text-base">Chỉ số an toàn & Cảnh báo rủi ro thiên nhiên</h4>
              <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">LƯU Ý THỰC ĐỊA</span>
            </div>
            <p className="text-sm text-gray-600">Đã ghi chú vùng ngập lũ cục bộ suối Đá Trắng và cảnh báo 6.5 km mất sóng viễn thông hoàn toàn từ Km 10 đến trạm K5.</p>
          </div>
          <div className="flex items-center shrink-0">
            <button className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200">Đã kèm khuyến nghị</button>
          </div>
        </div>
      </div>
    </div>
  );
};
