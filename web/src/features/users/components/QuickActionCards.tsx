import Link from "next/link";

export const QuickActionCards = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* Khám phá cung đường */}
      <Link href="/explore" className="group bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-gray-100 rounded-2xl p-5 transition-all">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-700 group-hover:scale-110 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
          </div>
          <span className="bg-white px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 border border-gray-100">120+ Tracks</span>
        </div>
        <h3 className="font-bold text-[15px] text-gray-900 mb-1">Khám phá Cung đường</h3>
        <p className="text-[11px] text-gray-500 mb-4 line-clamp-2">Kho 120+ tracklog GPS độ cao chuẩn, địa hình 3D đa giác.</p>
        <div className="text-[11px] font-bold text-[#154B36] flex items-center gap-1 group-hover:gap-2 transition-all">
          Truy cập bản đồ <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
        </div>
      </Link>

      {/* Tìm chuyến đi */}
      <Link href="/trips" className="group bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-gray-100 rounded-2xl p-5 transition-all">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-700 group-hover:scale-110 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <span className="bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-600 border border-emerald-100">Đoàn Mới</span>
        </div>
        <h3 className="font-bold text-[15px] text-gray-900 mb-1">Tìm chuyến đi cùng đoàn</h3>
        <p className="text-[11px] text-gray-500 mb-4 line-clamp-2">Tham gia cùng Mountain Leader chứng chỉ WFA quốc tế.</p>
        <div className="text-[11px] font-bold text-[#154B36] flex items-center gap-1 group-hover:gap-2 transition-all">
          Xem 30 đoàn mở <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
        </div>
      </Link>

      {/* Thuê thiết bị */}
      <Link href="/equipment" className="group bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-gray-100 rounded-2xl p-5 transition-all">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-700 group-hover:scale-110 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </div>
          <span className="bg-white px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 border border-gray-100">Kho Bắc - Nam</span>
        </div>
        <h3 className="font-bold text-[15px] text-gray-900 mb-1">Thuê thiết bị dã ngoại</h3>
        <p className="text-[11px] text-gray-500 mb-4 line-clamp-2">Lều chống bão, balo trợ lực, bộ đàm cự ly 5km VFRS.</p>
        <div className="text-[11px] font-bold text-[#154B36] flex items-center gap-1 group-hover:gap-2 transition-all">
          Kho đồ chuẩn cứu hộ <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
        </div>
      </Link>

      {/* Đăng ký Leader */}
      <Link href="/leader-program" className="group bg-[#F8FAFC] hover:bg-[#154B36] border border-gray-100 rounded-2xl p-5 transition-all text-gray-900 hover:text-white">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-700 group-hover:bg-[#1B5E41] group-hover:text-white group-hover:border-[#1B5E41] group-hover:scale-110 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
          </div>
          <span className="bg-amber-400 px-2 py-0.5 rounded text-[10px] font-bold text-black border border-amber-500 shadow-sm">PRO CAREER</span>
        </div>
        <h3 className="font-bold text-[15px] mb-1">Đăng ký làm Leader</h3>
        <p className="text-[11px] group-hover:text-emerald-100 text-gray-500 mb-4 line-clamp-2">Học bổng chứng chỉ WFA quốc tế và bảo hiểm nghề nghiệp.</p>
        <div className="text-[11px] font-bold group-hover:text-amber-400 text-[#154B36] flex items-center gap-1 group-hover:gap-2 transition-all">
          Nộp hồ sơ tuyển chọn <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
        </div>
      </Link>
    </div>
  );
};
