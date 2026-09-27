import Link from "next/link";

export const UserFooter = () => {
  return (
    <footer className="bg-[#F8FAFC] border-t border-gray-200 mt-20">
      {/* Top Footer Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-[#E6F4EA] rounded-xl flex items-center justify-center text-[#154B36] flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-gray-900 mb-1">Bảo Hiểm TrekCare 100M</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">Mọi chuyến đi xuất phát đều được kích hoạt hợp đồng bảo hiểm thể thao mạo hiểm tự động trước 24h.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-[#E6F4EA] rounded-xl flex items-center justify-center text-[#154B36] flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-gray-900 mb-1">Cứu Hộ Vệ Tinh 24/7</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">Hệ thống kết nối Garmin inReach hai chiều gửi tọa độ chính xác ngay cả khi khu vực leo núi mất hoàn toàn sóng di động.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-[#E6F4EA] rounded-xl flex items-center justify-center text-[#154B36] flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
            </div>
            <div>
              <h4 className="text-[13px] font-bold text-gray-900 mb-1">Leader Tiêu Chuẩn WFA</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed">100% người dẫn đường trải qua kiểm tra sơ cấp cứu dã ngoại Wilderness First Aid và định hướng bản đồ chuyên nghiệp.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1B5E41] text-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
            </div>
            <span className="font-extrabold text-sm text-[#0F172A]">Trekking System</span>
            <span className="text-[11px] text-gray-400 ml-2">© 2024 Trekking System. All rights reserved.</span>
          </div>
          
          <div className="flex items-center gap-6 text-[11px] font-semibold text-gray-500">
            <Link href="#" className="hover:text-[#1B5E41]">Quy chuẩn Trekking</Link>
            <Link href="#" className="hover:text-[#1B5E41]">Tiêu chuẩn An toàn</Link>
            <span className="flex items-center gap-1.5 text-[#DC2626]">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              Hotline 1800-9988
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
