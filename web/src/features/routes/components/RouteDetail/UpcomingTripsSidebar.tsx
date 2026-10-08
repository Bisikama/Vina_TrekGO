import Link from "next/link";
import { RouteData } from "../../data/mockRoutesData";

export const UpcomingTripsSidebar = ({ route }: { route: RouteData }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 sticky top-24">
      <div className="flex justify-between items-start mb-6">
         <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-1">GIÁ TRỌN GÓI / NGƯỜI</div>
            <div className="text-3xl font-extrabold text-[#1B5E41]">850.000đ</div>
         </div>
         <div className="text-right">
            <div className="text-sm font-bold text-gray-400 line-through">1.050.000đ</div>
            <div className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded mt-1 inline-block">-19% Early Bird</div>
         </div>
      </div>

      <div className="space-y-4 mb-6">
         <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">Chọn ngày khởi hành</label>
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white">
               <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="font-semibold text-gray-900">Thứ Bảy hàng tuần (1 Ngày)</span>
               </div>
               <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">Đang mở</span>
            </div>
         </div>

         <div>
            <div className="flex justify-between mb-2">
               <label className="block text-sm font-bold text-gray-900">Số lượng thành viên</label>
               <span className="text-xs font-bold text-emerald-600">Còn 8 chỗ</span>
            </div>
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-2 border border-gray-100 w-32">
                  <button className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-50 font-bold">-</button>
                  <div className="font-bold text-lg text-gray-900">2</div>
                  <button className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded text-gray-500 hover:bg-gray-50 font-bold">+</button>
               </div>
               <div className="text-right">
                  <div className="text-xs font-medium text-gray-500 mb-1">Tổng tạm tính</div>
                  <div className="text-xl font-extrabold text-gray-900">1.700.000đ</div>
               </div>
            </div>
         </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex gap-3 mb-6">
         <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
         <p className="text-xs text-emerald-800">Tài khoản đã xác thực. Bạn sẽ không bị trừ tiền ngay cho đến khi Leader xác nhận lịch đặt.</p>
      </div>

      <Link href="/bookings/TX-2411-VFRS" className="w-full bg-[#1B5E41] text-white font-bold py-3.5 rounded-xl hover:bg-[#1B5E41]/90 shadow-md flex items-center justify-center gap-2 mb-3">
         Đặt chuyến đi này
         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
      </Link>
      
      <button className="w-full bg-gray-50 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-100 flex items-center justify-center gap-2 text-sm border border-gray-200 mb-6">
         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
         Yêu cầu tư vấn thêm qua Zalo/Hotline
      </button>
      
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
         Bảo mật thanh toán VNPAY/Momo 100%
      </div>
    </div>
  );
};
