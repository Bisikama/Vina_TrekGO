import Image from "next/image";
import Link from "next/link";

interface PopularTripProps {
  id: string;
  name: string;
  dates: string;
  days: string;
  leaderName: string;
  leaderTitle: string;
  leaderAvatar: string;
  joined: number;
  total: number;
  price: string;
  departure: string;
}

const PopularTripCard = ({ trip }: { trip: PopularTripProps }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          {trip.dates}
        </div>
        <span className="bg-[#F8FAFC] text-gray-600 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
          {trip.days}
        </span>
      </div>

      <h3 className="font-extrabold text-[15px] text-gray-900 leading-tight mb-5 flex-grow">
        {trip.name}
      </h3>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          <Image src={trip.leaderAvatar} alt={trip.leaderName} width={40} height={40} className="object-cover w-full h-full" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-gray-900 flex items-center gap-1">
            {trip.leaderName}
            <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
          </div>
          <div className="text-[10px] text-gray-500">{trip.leaderTitle}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
          <span>Thành viên đã tham gia</span>
          <span className="text-gray-900">{trip.joined} / {trip.total} Trekker</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-[#154B36] h-1.5 rounded-full" 
            style={{ width: `${(trip.joined / trip.total) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="flex items-end justify-between pt-4 border-t border-gray-100">
        <div>
          <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">Trọn gói từ {trip.departure}</div>
          <div className="text-[16px] font-black text-gray-900">{trip.price}đ</div>
        </div>
        <Link href={`/trips/${trip.id}`} className="bg-[#154B36] hover:bg-[#0D3425] text-white px-4 py-2 rounded-xl text-[12px] font-bold transition-colors">
          Xem & Đặt chỗ
        </Link>
      </div>
    </div>
  );
};

export const PopularTrips = () => {
  const trips: PopularTripProps[] = [
    {
      id: "lt-1",
      name: "Lảo Thẩn: Đỉnh Gió & Biển Hoàng Hôn Y Tý",
      dates: "06/12 - 08/12/2024",
      days: "2N1Đ",
      leaderName: "Trần Tuấn",
      leaderTitle: "Leader Cấp 3 • 58 chuyến",
      leaderAvatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100&auto=format&fit=crop",
      joined: 12,
      total: 15,
      price: "2.450.000",
      departure: "Hà Nội"
    },
    {
      id: "bmlt-1",
      name: "Bạch Mộc Lương Tử (Kỳ Quan San) - Chinh Phục Muối",
      dates: "13/12 - 15/12/2024",
      days: "3N2Đ",
      leaderName: "Đặng Phong",
      leaderTitle: "Leader Cấp 4 • Chuyên gia cứu hộ",
      leaderAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop",
      joined: 14,
      total: 16,
      price: "3.200.000",
      departure: "Hà Nội"
    },
    {
      id: "nkh-1",
      name: "Nam Kang Ho Ta - Rừng Nguyên Sinh Thâm U Hoàng Liên",
      dates: "20/12 - 22/12/2024",
      days: "3N2Đ",
      leaderName: "Lê Mai Anh",
      leaderTitle: "Leader Cấp 3 • WFA Giảng viên",
      leaderAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop",
      joined: 8,
      total: 12,
      price: "3.850.000",
      departure: "Sa Pa"
    }
  ];

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[17px] font-extrabold text-gray-900 flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#154B36]"></span>
            Chuyến đi khởi hành phổ biến tháng này
          </h2>
          <span className="text-[11px] text-gray-500 font-medium">Đoàn mở có Mountain Leader dẫn đường, bảo hiểm TrekCare tiêu chuẩn</span>
        </div>
        <Link href="/trips" className="hidden sm:flex items-center gap-1 text-[12px] font-bold text-[#154B36] hover:text-[#0D3425]">
          Xem tất cả 42 chuyến
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trips.map((trip) => (
          <PopularTripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  );
};
