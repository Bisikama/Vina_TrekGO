import Image from "next/image";
import Link from "next/link";
import { TripData } from "../../data/mockTripsData";

export const TripHeader = ({ trip }: { trip: TripData }) => {
  const dayOfWeek = trip.date.rawStart
    ? ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"][
        new Date(trip.date.rawStart).getDay()
      ]
    : "";

  const remainingSlots = Math.max(0, trip.slots.total - trip.slots.booked);

  return (
    <div className="bg-white">
      {/* Top Breadcrumb & Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center text-[11px] text-gray-500 font-medium gap-2">
          <Link href="/" className="hover:text-gray-900">Trang chủ</Link>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          <Link href="/trips" className="hover:text-gray-900">Chuyến đi ghép đoàn</Link>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          <span className="text-gray-900 truncate max-w-[200px] sm:max-w-md">{trip.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert("Đã sao chép liên kết chuyến đi!");
              }
            }}
            className="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            Chia sẻ
          </button>
          {trip.isVFRSVerified && (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-white bg-[#154B36] px-3 py-1.5 rounded-lg">
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              CHUẨN AN TOÀN VFRS
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Title Section */}
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3 text-[11px] font-bold">
              <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {trip.status.label} (Còn {remainingSlots} chỗ)
              </span>
              {trip.isVFRSVerified && (
                <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Bảo hiểm VFRS 100tr
                </span>
              )}
              <span className={`${trip.difficulty.color} px-2 py-1 rounded border border-opacity-20 flex items-center gap-1`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                Độ khó: {trip.difficulty.label}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-3">
              {trip.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-600">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                {trip.date.start} – {trip.date.end}/{trip.date.year} {dayOfWeek ? `(${dayOfWeek})` : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                {trip.location.name}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                {trip.totalDistance ? `${trip.totalDistance} trekking` : "Theo lịch trình đoàn"}
              </span>
            </div>
          </div>
        </div>

        {/* Hero Image Section */}
        <div className="relative h-[280px] sm:h-[380px] lg:h-[450px] w-full rounded-2xl overflow-hidden mb-8 shadow-sm">
          <Image
            src={trip.image}
            alt={trip.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
        </div>

        {/* Quick Stats & Leader Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Leader Info */}
          <div className="md:col-span-1 bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center gap-3">
            <div className="relative shrink-0">
              <Image src={trip.leader.avatar || "/images/avatars/avatar-1.png"} alt={trip.leader.name} width={48} height={48} className="rounded-full object-cover" />
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                <div className="bg-emerald-500 w-3 h-3 rounded-full border border-white"></div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm font-bold text-gray-900">{trip.leader.name}</span>
                <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">{trip.leader.badge}</span>
              </div>
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                {trip.leader.experience || "Đội ngũ dẫn đoàn chuyên nghiệp Vina TrekGO"}
              </div>
            </div>
          </div>

          {/* Stats Boxes */}
          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col justify-center">
              <div className="text-[10px] text-gray-500 font-bold mb-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                THỜI LƯỢNG
              </div>
              <div className="text-lg font-extrabold text-gray-900">{trip.duration}</div>
              <div className="text-[10px] text-gray-500 mt-1">
                {trip.durationNights ? `${trip.durationNights} đêm` : "Đi trong ngày"}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col justify-center">
              <div className="text-[10px] text-gray-500 font-bold mb-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                QUÃNG ĐƯỜNG
              </div>
              <div className="text-lg font-extrabold text-gray-900">{trip.totalDistance || "Theo đoàn"}</div>
              <div className="text-[10px] text-gray-500 mt-1">
                {trip.totalDistance ? "Trekking khứ hồi" : "Cung đường tự do"}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col justify-center">
              <div className="text-[10px] text-gray-500 font-bold mb-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l7-7 7 7M5 19l7-7 7 7"></path></svg>
                ĐỘ CAO ĐỈNH
              </div>
              <div className="text-lg font-extrabold text-gray-900">{trip.maxElevation || "Địa hình thực tế"}</div>
              <div className="text-[10px] text-gray-500 mt-1">
                {trip.maxElevation ? "So với mực nước biển" : "Chuẩn bị thể lực phù hợp"}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col justify-center">
              <div className="text-[10px] text-gray-500 font-bold mb-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                QUY MÔ ĐOÀN
              </div>
              <div className="text-base sm:text-lg font-extrabold text-gray-900 leading-tight">
                {trip.slots.min ? `${trip.slots.min} – ${trip.slots.total} người` : `Tối đa ${trip.slots.total} người`}
              </div>
              <div className="text-[10px] text-emerald-600 font-bold mt-1">
                Đã có {trip.slots.booked}/{trip.slots.total} chỗ • Còn {remainingSlots} chỗ
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
