import React from 'react';

export const PublishNotesForm = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <h3 className="font-bold text-gray-900 text-lg mb-1">Ghi Chú Bổ Sung Cho Ban Thẩm Định An Toàn VFRS</h3>
      <p className="text-sm text-gray-500 mb-5">Thông tin chi tiết giúp Kiểm lâm địa bàn và Hội đồng an toàn phê duyệt độ khó chính xác.</p>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Mô tả đặc điểm lộ trình & Khuyến nghị trang bị:</label>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
            Tuyến đường có đoạn lội suối Đá Trắng sâu khoảng 50cm vào mùa khô, đá trơn nhiều rêu phong. Khuyến nghị trekker trang bị gậy leo núi, dép lội suối chuyên dụng có gai bám và túi chống nước cấp độ IPX7 cho toàn bộ thiết bị điện tử. Mùa mưa (tháng 9-11) nước dâng xiết tuyệt đối không tự ý vượt suối một mình.
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Đầu mối khẩn cấp / Trạm Kiểm Lâm phụ trách:</label>
            <div className="relative">
              <input 
                type="text" 
                defaultValue="Trạm Kiểm Lâm Kon Chu Răng - ĐT: 0269.384.8219 (Anh Ba Đạt)"
                className="w-full border border-gray-200 rounded-lg p-3 pl-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] bg-gray-50"
                readOnly
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Đề xuất Cấp độ thử thách (Tự đánh giá):</label>
            <div className="relative">
              <select className="w-full border border-gray-200 rounded-lg p-3 pl-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B4332] appearance-none bg-orange-50/50">
                <option>Cấp 4 / 5 - Thử thách (Địa hình dốc trơn & vượt suối đá)</option>
              </select>
              <svg className="w-4 h-4 text-orange-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <svg className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3 mt-4">
          <div className="w-5 h-5 bg-[#1B4332] rounded flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <div className="font-bold text-green-900 text-sm mb-1">Cam kết trách nhiệm dữ liệu thực địa VFRS</div>
            <p className="text-xs text-green-800">
              Tôi cam kết toàn bộ dữ liệu tracklog GPS và hình ảnh được ghi nhận trực tiếp từ chuyến đi thực địa ngày 15/11/2024. Tôi chịu trách nhiệm về tính trung thực của các cảnh báo rủi ro nhằm bảo vệ an toàn tính mạng cho cộng đồng Trekker.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
