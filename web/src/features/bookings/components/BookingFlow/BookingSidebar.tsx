import React from 'react';
import Image from 'next/image';

export const BookingSidebar = ({ equipmentCost = 0 }: { equipmentCost?: number }) => {
  const baseTripCost = 4900000;
  const vat = 392000;
  const discount = -200000;
  const grandTotal = baseTripCost + vat + discount + equipmentCost;

  return (
    <div className="w-full lg:w-[380px] shrink-0 space-y-4">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="relative h-48">
          <Image src="https://images.unsplash.com/photo-1541849546-216549281001?q=80&w=2070&auto=format&fit=crop" alt="Ta Xua" fill className="object-cover" />
          <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">
            Độ khó: Trung bình (3/5)
          </div>
          <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
            <p className="text-sm font-medium opacity-90">TÀ XÙA • BẮC YÊN • SƠN LA</p>
            <h3 className="text-lg font-bold mt-1">Chinh phục Sống Lưng Khủng Long Tà Xùa - Mùa Săn Mây Đại Ngàn</h3>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 bg-gray-50 p-3 rounded-lg flex items-start gap-3 border border-gray-100">
              <svg className="w-5 h-5 text-gray-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <div>
                <p className="text-xs text-gray-500">Khởi hành</p>
                <p className="font-semibold text-gray-900">15/11 - 17/11</p>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 p-3 rounded-lg flex items-start gap-3 border border-gray-100">
              <svg className="w-5 h-5 text-gray-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div>
                <p className="text-xs text-gray-500">Thời lượng</p>
                <p className="font-semibold text-gray-900">2N1Đ (Cuối tuần)</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-b border-gray-100 py-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  <Image src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=2070&auto=format&fit=crop" width={40} height={40} alt="Avatar" className="object-cover h-full w-full" />
                </div>
                <div>
                   <p className="font-semibold text-gray-900 text-sm flex items-center gap-1">Hoàng Nam <svg className="w-4 h-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></p>
                   <p className="text-xs text-gray-500">Chứng chỉ WFA Cứu hộ Quốc Tế</p>
                </div>
             </div>
             <div className="flex items-center gap-1">
               <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
               <span className="font-semibold text-sm">4.95</span>
             </div>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-3">CHI TIẾT CHI PHÍ</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Giá vé tour (2.450.000₫ × 2 người)</span>
                <span className="font-medium text-gray-900">{baseTripCost.toLocaleString('vi-VN')}₫</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Bảo hiểm mạo hiểm (100k/người)
                </span>
                <span className="font-medium text-gray-900">Miễn phí</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phụ kiểm lâm & Bộ KIT VFRS</span>
                <span className="font-medium text-gray-900">Đã bao gồm</span>
              </div>
              {equipmentCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Thuê thiết bị bổ sung</span>
                  <span className="font-medium text-gray-900">{equipmentCost.toLocaleString('vi-VN')}₫</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Thuế VAT (8%)</span>
                <span className="font-medium text-gray-900">{vat.toLocaleString('vi-VN')}₫</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Ưu đãi Trekker Hạng Bạc (Level 3)
                </span>
                <span className="font-medium">{discount.toLocaleString('vi-VN')}₫</span>
              </div>
            </div>
            
            <div className="border-t border-gray-100 mt-4 pt-4">
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="font-bold text-gray-900 uppercase">TỔNG THANH TOÁN</h4>
                  <p className="text-xs text-gray-500">Đã gồm VAT, bảo hiểm & đồ thuê</p>
                </div>
                <div className="text-2xl font-bold text-green-700">{grandTotal.toLocaleString('vi-VN')}₫</div>
              </div>
            </div>

           
          </div>
        </div>
      </div>
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3 text-green-800">
         <svg className="w-6 h-6 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
         <div>
            <h4 className="font-semibold text-green-900 text-sm">Cam kết an toàn</h4>
            <p className="text-xs mt-1">Hoàn cọc 100% nếu bão lũ bất khả kháng theo lệnh kiểm lâm, hoặc hủy trước 7 ngày khởi hành.</p>
         </div>
      </div>
    </div>
  );
};
