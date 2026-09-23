import Link from "next/link";

export const ActiveRentalAlert = () => {
  return (
    <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] text-[#166534] flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[12px] font-extrabold text-[#166534]">ĐƠN THUÊ THIẾT BỊ RENT-8823</span>
            <span className="bg-[#22C55E] text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase">Đã kiểm định và đóng gói sẵn sàng</span>
          </div>
          <p className="text-[12px] text-[#154B36] font-medium leading-relaxed">
            3 món: Lều siêu nhẹ Naturehike Cloud Up 2P (x1), Balo Osprey Atmos AG 65L (x1), Cặp gậy Trekking Black Diamond Carbon (x1)
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-[#166534] bg-[#DCFCE7] px-3 py-1.5 rounded-lg font-medium whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Nhận tại trạm lúc 05:15 (29/11)
        </div>
        <Link href="/equipment/rentals/RENT-8823" className="w-full sm:w-auto text-center bg-[#E2E8F0] hover:bg-[#CBD5E1] text-[#1E293B] px-4 py-2 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-1">
          Chi tiết đơn thuê
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </Link>
      </div>
    </div>
  );
};
