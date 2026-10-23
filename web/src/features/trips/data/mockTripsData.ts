export interface ItineraryDay {
  day: string;
  title: string;
  activities: {
    time?: string;
    description: string;
    isHighlight?: boolean;
  }[];
}

export interface TripCostBreakdownItem {
  id?: string;
  category: string;
  name: string;
  kind?: string;
  basis?: string;
  unitPrice: number;
  quantity?: number;
  durationUnits?: number;
  capacityPerUnit?: number | null;
  includedInPrice: boolean;
  sourceNote?: string | null;
}
export interface TripData {
  id: string;
  duration: string;
  difficulty: {
    level: string;
    label: string;
    color: string;
  };
  isVFRSVerified: boolean;
  location: {
    name: string;
    distance: string;
  };
  image: string;
  date: {
    start: string;
    end: string;
    year: string;
    rawStart?: string;
    rawEnd?: string;
  };
  status: {
    label: string;
    color: string;
  };
  title: string;
  description: string;
  leader: {
    name: string;
    avatar: string;
    badge: string;
    experience?: string;
    rating?: number;
    totalTrips?: number;
    porters?: number;
  };
  slots: {
    booked: number;
    total: number;
    min?: number;
    statusText?: string;
  };
  price: number;
  action: {
    label: string;
    variant: 'primary' | 'secondary' | 'disabled';
  };
  // Detailed fields
  maxElevation?: string;
  totalDistance?: string;
  durationDays?: number;
  durationNights?: number;
  pickup?: {
    id?: string;
    name: string;
    address?: string;
  } | null;
  checkpoints?: {
    id?: string;
    name: string;
    description?: string | null;
    sequence?: number;
    isRequired?: boolean;
  }[];
  routes?: {
    id?: string;
    snapshotName?: string;
    snapshotDifficulty?: string | null;
    snapshotDistanceKm?: string | null;
    sequence?: number;
  }[];
  itinerary?: ItineraryDay[];
  includedServices?: string[];
  excludedServices?: string[];
  requiredEquipment?: { name: string; action: string }[];
  suggestedEquipment?: { name: string; action: string }[];
  costItems?: TripCostBreakdownItem[];
  priceExplanation?: string | null;
}

export const mockTripsData: TripData[] = [
  {
    id: "trip-1",
    duration: "2N1Đ",
    difficulty: { level: "Medium", label: "Trung bình", color: "bg-emerald-100 text-emerald-700" },
    isVFRSVerified: true,
    location: { name: "Bắc Yên, Sơn La", distance: "14.5 km" },
    image: "https://images.unsplash.com/photo-1542662565-7e4fd1e56898?q=80&w=1200&auto=format&fit=crop",
    date: { start: "15/11", end: "17/11", year: "2024" },
    status: { label: "Sắp khởi hành", color: "text-amber-500" },
    title: "Chinh phục Sống Lưng Khủng Long Tà Xùa - Mùa Săn Mây Đại Ngàn",
    description: "Hành trình men theo dốc đá sống lưng Háng Đồng, ngắm biển mây cuồn cuộn độ cao 2.865m và thưởng...",
    maxElevation: "2.865 m",
    totalDistance: "14.5 km",
    leader: {
      name: "Hoàng Nam",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop",
      badge: "Leader",
      experience: "WFA Certified • 6 năm kn",
      rating: 4.95,
      totalTrips: 82,
      porters: 3
    },
    slots: { booked: 8, total: 15, statusText: "Còn 7" },
    price: 2450000,
    action: { label: "Xem chi tiết", variant: "secondary" },
    itinerary: [
      {
        day: "Ngày 0 (Thứ 6 - 15/11)",
        title: "Hà Nội ➔ Thị trấn Bắc Yên",
        activities: [
          { time: "22:00", description: "Tập trung: Cổng chính Công viên Cầu Giấy. Xe Limousine 16 chỗ cao cấp đón đoàn, sắp xếp hành lý." },
          { time: "22:30", description: "An toàn đoàn: Leader phổ biến quy tắc an toàn leo núi, kiểm tra lại danh mục đồ dùng cá nhân, phát bộ đàm VHF và kính bảo hộ ngoại vi." },
          { time: "01:00", description: "Nghỉ ngơi: Có mặt tại thị trấn Bắc Yên, nhận phòng homestay sạch sẽ, tắm rửa và ngủ sớm chuẩn bị thể lực." }
        ]
      },
      {
        day: "Ngày 1 (Thứ 7 - 16/11)",
        title: "Bản Công ➔ Trạm Cứu hộ SOS #02 ➔ Lán Đồi Gió",
        activities: [
          { time: "06:30", description: "Tiếp năng lượng: Ăn sáng phở nóng Thị Bắc, thu xếp hành lý. Chia tải gửi porter, di chuyển xe ôm bản địa qua đường đèo đất 5km." },
          { time: "08:00", description: "Bắt đầu leo: Trekking qua dốc Ba Tầng (km 4.2 - 1.500m), đắm mình trong vùng thảo quả mọc lan và rừng dẻ sồi nguyên sinh." },
          { time: "11:30", description: "Nghỉ trưa rừng: Ăn trưa dã chiến xôi nương, thịt nướng xông khói, bổ sung điện giải tại suối khoáng." },
          { time: "14:00", description: "Check Trạm SOS #02: Dừng chân tại trạm cứu hộ liên lạc VFRS (km 7.0 - 2.100m), lấy nước sạch tự nhiên qua bộ lọc, leader check in an toàn.", isHighlight: true },
          { time: "16:30", description: "Đến Lán nghỉ Đồi Gió: Nhận chăn đệm giữ nhiệt tại lán gỗ kín gió. Ngắm hoàng hôn biển mây ngút ngàn. Thưởng thức bữa tiệc BBQ gà đồi nướng mắc khén." }
        ]
      },
      {
        day: "Ngày 2 (CN - 17/11)",
        title: "Chóp Tà Xùa (2.865m) ➔ Sống Lưng Khủng Long ➔ Bản Háng Đồng ➔ Hà Nội",
        activities: [
          { time: "04:30", description: "Đón bình minh sớm: Dậy sớm, nhâm nhi cà phê nóng, thưởng ngoạn đại dương mây cuồn cuộn phản chiếu ánh hồng mặt trời lấp ló." },
          { time: "06:30", description: "Chinh phục đỉnh 2.865m: Hành trình qua rừng rêu ma mị bám đầy thân mộc, chạm tay vào chóp inox biểu tượng Tà Xùa." },
          { time: "09:00", description: "Vượt Sống Lưng Khủng Long: Thách thức qua dải núi hẹp chênh vênh, vách đứng hai bên. Có hỗ trợ dây cáp an toàn ở các điểm khó.", isHighlight: true },
          { time: "12:00", description: "Về đích & Tắm khoáng: Về đến Bản Háng Đồng. Xe đón về Bắc Yên ăn trưa. Trải nghiệm tắm khoáng nóng phục hồi cơ bắp." },
          { time: "15:00", description: "Trở về Hà Nội: Lên xe Limousine về Hà Nội, dự kiến 20:30 có mặt ở Cầu Giấy. Chia tay đoàn và nhận chứng nhận Trekker." }
        ]
      }
    ],
    includedServices: [
      "Xe Limousine khứ hồi Hà Nội - Bắc Yên & xe ôm bản địa",
      "Ăn uống: 5 bữa chính, 2 bữa phụ trên núi",
      "Lán gỗ ngủ qua đêm trên núi (chăn đệm giữ ấm)",
      "Porter vận chuyển đồ chung (lều, túi ngủ, thực phẩm)",
      "Bảo hiểm du lịch mạo hiểm tối đa 100.000.000đ/người",
      "Túi y tế cá nhân, thuốc men dự phòng"
    ],
    excludedServices: [
      "Chi phí cá nhân ngoài chương trình (mua sắm, giặt ủi)",
      "Tiền tip cho Porter/Leader (không bắt buộc nhưng khuyên khích)",
      "Chi phí thuê đồ cá nhân (balo trekking, gậy, giày...)"
    ],
    requiredEquipment: [
      { name: "Giày trekking (cổ lửng/cao)", action: "Thuê" },
      { name: "Balo leo núi 30L-40L", action: "Thuê" },
      { name: "Áo khoác gió chống nước", action: "Thuê" },
      { name: "Túi ngủ giữ nhiệt 0°C", action: "Thuê" }
    ],
    suggestedEquipment: [
      { name: "Gậy leo núi", action: "Thuê" },
      { name: "Bình nước cá nhân 1.5L", action: "Mang theo" },
      { name: "Đèn pin đội đầu", action: "Thuê" },
      { name: "Pin sạc dự phòng", action: "Mang theo" }
    ]
  },
  {
    id: "trip-2",
    duration: "3N2Đ",
    difficulty: { level: "Hard", label: "Khó / Thử thách", color: "bg-red-100 text-red-700" },
    isVFRSVerified: true,
    location: { name: "Sa Pa, Lào Cai", distance: "19 km" },
    image: "https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?q=80&w=800&auto=format&fit=crop",
    date: { start: "22/11", end: "24/11", year: "2024" },
    status: { label: "• Chỉ còn 2 chỗ", color: "text-red-500 font-medium" },
    title: "Băng Rừng Rêu & Chạm Đỉnh Fansipan 3.143m Tuyến Trạm Tôn",
    description: "Cung đường truyền thống an toàn nhất chinh phục Nóc Nhà Đông Dương. Đêm nghỉ lán 2.800m ấm cúng, có...",
    leader: {
      name: "Mai Phương",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop",
      badge: "Master Guide",
      experience: "WFA Certified • 8 năm kn",
      rating: 4.98,
      totalTrips: 142,
      porters: 5
    },
    slots: { booked: 10, total: 12, statusText: "Sắp đóng đăng ký" },
    price: 3200000,
    action: { label: "Giữ chỗ ngay", variant: "primary" }
  },
  {
    id: "trip-3",
    duration: "2N1Đ",
    difficulty: { level: "Easy", label: "Dễ - Trung bình", color: "bg-blue-100 text-blue-700" },
    isVFRSVerified: true,
    location: { name: "Bát Xát, Lào Cai", distance: "16 km" },
    image: "https://images.unsplash.com/photo-1526392060635-9d6019884377?q=80&w=800&auto=format&fit=crop",
    date: { start: "29/11", end: "01/12", year: "2024" },
    status: { label: "Còn 8 chỗ", color: "text-emerald-600" },
    title: "Săn Bình Minh Biển Mây Lảo Thẩn & Cắm Trại Đêm Y Tý",
    description: "Nóc nhà Y Tý với độ cao 2.860m. Cung trek lý tưởng hàng đầu cho người mới bắt đầu muốn trải nghiệm...",
    leader: {
      name: "Đặng Tuấn",
      avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100&auto=format&fit=crop",
      badge: "Leader",
      experience: "WFA Certified • 4 năm kn",
      rating: 4.89,
      totalTrips: 56,
      porters: 2
    },
    slots: { booked: 6, total: 14 },
    price: 1850000,
    action: { label: "Xem chi tiết", variant: "secondary" }
  },
  {
    id: "trip-4",
    duration: "2N1Đ",
    difficulty: { level: "Medium", label: "Trung bình +", color: "bg-yellow-100 text-yellow-700" },
    isVFRSVerified: true,
    location: { name: "Lạc Dương, Lâm Đồng", distance: "27 km" },
    image: "https://images.unsplash.com/photo-1582468546235-9c8eb0f17105?q=80&w=800&auto=format&fit=crop",
    date: { start: "06/12", end: "08/12", year: "2024" },
    status: { label: "Còn 5 chỗ", color: "text-emerald-600" },
    title: "Hành Trình Rừng Thông & Cây Pơmu Cổ Thụ Bidoup Núi Bà",
    description: "Khám phá khu dự trữ sinh quyển thế giới, băng qua cầu phao sông Đa Nhim, chiêm ngưỡng cây Pơmu hơn 1.3...",
    leader: {
      name: "Lê Hải Đăng",
      avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=100&auto=format&fit=crop",
      badge: "Leader",
      experience: "WFA Certified • 5 năm kn",
      rating: 4.92,
      totalTrips: 110,
      porters: 4
    },
    slots: { booked: 7, total: 12 },
    price: 2600000,
    action: { label: "Xem chi tiết", variant: "secondary" }
  },
  {
    id: "trip-5",
    duration: "3N2Đ",
    difficulty: { level: "Hard", label: "Khó / Thử thách", color: "bg-red-100 text-red-700" },
    isVFRSVerified: true,
    location: { name: "Phong Thổ, Lai Châu", distance: "30 km" },
    image: "https://images.unsplash.com/photo-1620025983803-0c36b8c801e0?q=80&w=800&auto=format&fit=crop",
    date: { start: "13/12", end: "15/12", year: "2024" },
    status: { label: "Sắp đầy đoàn", color: "text-amber-500" },
    title: "Chinh phục Kỳ Quan Đá Bạch Mộc Lương Tử - Ky Quan San 3.046m",
    description: "Top 4 đỉnh núi cao nhất Việt Nam nổi tiếng với sống núi đá cheo leo, rừng trúc bạt ngàn và điểm ngắm bình...",
    leader: {
      name: "A Sờ (Sùng A Sờ)",
      avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=100&auto=format&fit=crop",
      badge: "Local Native",
      experience: "WFA Certified • 9 năm kn",
      rating: 5.0,
      totalTrips: 180,
      porters: 8
    },
    slots: { booked: 11, total: 12, statusText: "Còn đúng 1 vô" },
    price: 3450000,
    action: { label: "Xem chi tiết", variant: "secondary" }
  },
  {
    id: "trip-6",
    duration: "3N2Đ",
    difficulty: { level: "Hard", label: "Khó (Đi bộ dài)", color: "bg-red-100 text-red-700" },
    isVFRSVerified: true,
    location: { name: "Lâm Đồng - Bình Thuận", distance: "35 km" },
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800&auto=format&fit=crop",
    date: { start: "20/12", end: "22/12", year: "2024" },
    status: { label: "Đã đủ quân số", color: "text-gray-500" },
    title: "Thử Thách Xuyên Rừng Bán Sa Mạc Tà Năng - Phan Dũng",
    description: "Hành trình chuyển tiếp từ cao nguyên xanh mát xuống duyên hải đầy nắng gió. Cung trekking huyền thoại vớ...",
    leader: {
      name: "Võ Minh Trí",
      avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=100&auto=format&fit=crop",
      badge: "Leader",
      experience: "WFA Certified • 7 năm kn",
      rating: 4.94,
      totalTrips: 95,
      porters: 6
    },
    slots: { booked: 14, total: 14, statusText: "Đã đủ đoàn" },
    price: 2750000,
    action: { label: "Báo khi có chỗ", variant: "disabled" }
  }
];
