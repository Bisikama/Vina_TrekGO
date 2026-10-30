import {
  EquipmentItem,
  LiveNavTelemetry,
  RentalOrder,
  Trail,
  Trip,
  UserProfile,
} from "@/types";

export const mockUserProfile: UserProfile = {
  id: "usr-001",
  name: "Anh Thư",
  email: "anhthu.trek@trekgo.vn",
  avatar:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
  role: "TREKKER",
  completedTripsCount: 12,
  totalDistanceKm: 168.5,
  unlockedTrailsCount: 4,
  savedPoints: 1240,
};

export const mockTrails: Trail[] = [
  {
    id: "trail-tanang",
    name: "Tà Năng – Phan Dũng",
    region: "Lâm Đồng ➔ Bình Thuận",
    difficulty: "Khó",
    distanceKm: 14.5,
    elevationGainM: 850,
    duration: "3N2Đ",
    price: 49000,
    isUnlocked: true,
    rating: 4.9,
    reviewCount: 428,
    imageUrl:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
    description:
      "Cung đường trekking huyền thoại vượt qua các đồi cỏ cháy bạt ngàn, xuyên qua rừng thông Lâm Đồng và đổ dốc đá Phan Dũng ra biển Bình Thuận.",
    highlights: [
      "Đồi lính lộng gió",
      "Hoàng hôn sống lưng khủng long",
      "Suối nước đá tự nhiên",
    ],
    terrainType: "Rừng thông & Đồi cỏ cháy",
    checkpoints: [
      {
        id: "cp-1",
        order: 1,
        name: "Trạm Kiểm Lâm Tà Năng",
        elevation: 640,
        distanceFromStartKm: 0,
        status: "COMPLETED",
        coords: { x: 38, y: 292 },
      },
      {
        id: "cp-2",
        order: 2,
        name: "Cột mốc Đồi Lính",
        elevation: 840,
        distanceFromStartKm: 8.4,
        status: "PENDING",
        mission: {
          id: "ms-01",
          title: "Nhiệm vụ Check-in Cột Mốc Đồi Lính",
          description:
            "Chụp ảnh xác thực tại biển kiểm lâm và kiểm tra sức khỏe đồng đội.",
          type: "PHOTO",
          instruction: "Nút check-in tự mở khi vào bán kính GPS 30m.",
          isDone: false,
          rewardPoints: 100,
        },
        coords: { x: 205, y: 145 },
      },
      {
        id: "cp-3",
        order: 3,
        name: "Đỉnh 986m – Sống Lưng Khủng Long",
        elevation: 986,
        distanceFromStartKm: 11.2,
        status: "PENDING",
        mission: {
          id: "ms-02",
          title: "Khảo sát hướng gió và tầm nhìn",
          description: "Ghi lại vận tốc gió và độ ẩm trước khi đổ dốc.",
          type: "QUIZ",
          instruction: "Trả lời câu hỏi trắc nghiệm an toàn địa hình.",
          isDone: false,
          rewardPoints: 150,
        },
        coords: { x: 320, y: 80 },
      },
      {
        id: "cp-4",
        order: 4,
        name: "Suối Nhỏ Cắm Trại",
        elevation: 450,
        distanceFromStartKm: 13.0,
        status: "PENDING",
        coords: { x: 360, y: 130 },
      },
      {
        id: "cp-5",
        order: 5,
        name: "Cổng Ra Phan Dũng",
        elevation: 120,
        distanceFromStartKm: 14.5,
        status: "PENDING",
        coords: { x: 385, y: 190 },
      },
    ],
  },
  {
    id: "trail-pinhatt",
    name: "Đỉnh Pinhatt – Hồ Tuyền Lâm",
    region: "Đà Lạt, Lâm Đồng",
    difficulty: "Trung bình",
    distanceKm: 8.2,
    elevationGainM: 420,
    duration: "1 Ngày",
    price: 0,
    isUnlocked: true,
    rating: 4.8,
    reviewCount: 195,
    imageUrl:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
    description:
      "Chinh phục nóc nhà khu vực hồ Tuyền Lâm với tầm nhìn 360 độ xuống toàn cảnh hồ nước xanh ngọc bích và rừng thông cổ thụ.",
    highlights: [
      "Toàn cảnh Hồ Tuyền Lâm",
      "Đồi thông nguyên sinh",
      "Cung đường ngắn trong ngày",
    ],
    terrainType: "Rừng thông cao nguyên",
    checkpoints: [
      {
        id: "cp-p1",
        order: 1,
        name: "Bến thuyền Đá Tiên",
        elevation: 1450,
        distanceFromStartKm: 0,
        status: "COMPLETED",
        coords: { x: 50, y: 280 },
      },
      {
        id: "cp-p2",
        order: 2,
        name: "Đỉnh Pinhatt 1.696m",
        elevation: 1696,
        distanceFromStartKm: 4.1,
        status: "PENDING",
        coords: { x: 220, y: 110 },
      },
    ],
  },
  {
    id: "trail-bidoup",
    name: "Đỉnh Bidoup Núi Bà (2.287m)",
    region: "Lạc Dương, Lâm Đồng",
    difficulty: "Khó",
    distanceKm: 27.0,
    elevationGainM: 1150,
    duration: "2N1Đ",
    price: 69000,
    isUnlocked: false,
    rating: 4.9,
    reviewCount: 312,
    imageUrl:
      "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80",
    description:
      "Khám phá vương quốc rêu phong và cây pơmu đại thụ hơn 1.300 năm tuổi giữa vườn quốc gia Bidoup Núi Bà.",
    highlights: [
      "Cây Pơmu cổ thụ nghìn năm",
      "Rừng rêu ma mị",
      "Cắm trại sườn núi 2.000m",
    ],
    terrainType: "Rừng mưa nhiệt đới & Rêu ẩm",
    checkpoints: [],
  },
  {
    id: "trail-chuyangsin",
    name: "Vườn Quốc Gia Chư Yang Sin",
    region: "Đắk Lắk",
    difficulty: "Thách thức",
    distanceKm: 32.0,
    elevationGainM: 1400,
    duration: "3N2Đ",
    price: 79000,
    isUnlocked: false,
    rating: 4.7,
    reviewCount: 140,
    imageUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
    description:
      "Thách thức đỉnh cao mái nhà cao nguyên Đắk Lắk với địa hình dốc đứng, thác nước gầm réo và hệ sinh thái đa dạng độc nhất vô nhị.",
    highlights: ["Đỉnh 2.442m", "Thác ghềnh hiểm trở", "Trải nghiệm sinh tồn"],
    terrainType: "Rừng rậm nguyên sinh",
    checkpoints: [],
  },
];

export const mockTrips: Trip[] = [
  {
    id: "trip-tanang-01",
    type: "PUBLIC",
    name: "Tà Năng – Phan Dũng (3N2Đ)",
    trailId: "trail-tanang",
    destination: "Lâm Đồng – Bình Thuận",
    startDate: "12 Tháng 10, 2026",
    endDate: "14 Tháng 10, 2026",
    durationDays: 3,
    status: "UPCOMING",
    leader: {
      name: "Leader Nam Nguyễn",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
      phone: "0908 123 456",
      rating: 5.0,
      badge: "Certified Wilderness First Aid",
    },
    capacity: 12,
    enrolledCount: 8,
    pricePerPerson: 2850000,
    bookingCode: "#BK-8842",
    logistics: {
      pickupLocation: "Bến xe Miền Đông mới · Cổng số 3",
      pickupTime: "21:00 Thứ Sáu, 11/10/2026",
      vehicleModel: "Ford Transit 16 chỗ TrekGo Express",
      vehiclePlate: "51B-829.41",
      driverName: "Bác Ba Lái Xe",
      driverPhone: "0912 345 678",
      notes:
        "Có mặt trước 30 phút để kiểm tra balo & nhận thiết bị thuê tại xe.",
    },
    weather: {
      tempC: 22,
      condition: "Nắng nhẹ · Mây rải rác",
      rainRisk: false,
      rainChancePercent: 15,
      humidityPercent: 72,
      windSpeedKmh: 14,
      riskNotice:
        "Thời tiết ban ngày lý tưởng (20-24°C), ban đêm hạ nhiệt còn 15°C.",
    },
    participants: [
      {
        id: "p-1",
        name: "Leader Nam",
        avatar:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
        role: "LEADER",
      },
      {
        id: "p-2",
        name: "Anh Thư (Bạn)",
        avatar:
          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        role: "MEMBER",
      },
      {
        id: "p-3",
        name: "Nguyễn Văn A",
        avatar:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
        role: "MEMBER",
        isOffRoute: true,
        deviationMeters: 140,
        lastKnownLocation: "Sườn dốc phía Đông cột mốc 2",
      },
      {
        id: "p-4",
        name: "Hoàng Mai",
        avatar:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
        role: "MEMBER",
      },
      {
        id: "p-5",
        name: "Trần Bách",
        avatar:
          "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80",
        role: "MEMBER",
      },
      {
        id: "p-6",
        name: "Lê Thảo",
        avatar:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80",
        role: "MEMBER",
      },
    ],
    rentedItemsCount: 1,
  },
];

export const mockEquipment: EquipmentItem[] = [
  {
    id: "eq-tent-01",
    name: "Lều Chống Nước NatureHike Cloud Up 2",
    category: "Tent",
    dailyRate: 90000,
    deposit: 800000,
    stock: 14,
    imageUrl:
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=500&q=80",
    specs: [
      "Trọng lượng: 1.8kg",
      "Chỉ số chống nước: PU 4000mm",
      "Khung nhôm 7001 siêu nhẹ",
    ],
    description:
      "Lều 2 người 4 mùa siêu nhẹ, chịu được gió giật mạnh trên sống lưng núi, chống mưa to kéo dài.",
    rating: 4.9,
  },
  {
    id: "eq-backpack-01",
    name: "Balo Trợ Lực Osprey Atmos AG 65L",
    category: "Backpack",
    dailyRate: 110000,
    deposit: 1500000,
    stock: 8,
    imageUrl:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=500&q=80",
    specs: [
      "Dung tích: 65L",
      "Hệ thống đệm lưng Anti-Gravity",
      "Áo mưa balo đi kèm",
    ],
    description:
      "Balo leo núi đỉnh cao với hệ đệm lưới thoáng khí tuyệt đối, giảm 40% trọng lực đè lên cột sống.",
    rating: 5.0,
  },
  {
    id: "eq-pole-01",
    name: "Gậy Trekking Carbon Black Diamond Trail Pro",
    category: "Trekking Pole",
    dailyRate: 45000,
    deposit: 500000,
    stock: 22,
    imageUrl:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=500&q=80",
    specs: [
      "Chất liệu: Carbon 100%",
      "Khóa FlickLock Pro bằng thép",
      "Trọng lượng 240g/cây",
    ],
    description:
      "Cặp gậy trekking chuyên dụng giúp giảm tải áp lực khớp gối khi leo dốc và trượt đá.",
    rating: 4.8,
  },
  {
    id: "eq-sleep-01",
    name: "Túi Ngủ Lông Vũ Marmot Trestles 15 (-9°C)",
    category: "Sleeping Bag",
    dailyRate: 65000,
    deposit: 700000,
    stock: 12,
    imageUrl:
      "https://images.unsplash.com/photo-1520092352425-969992e22c08?auto=format&fit=crop&w=500&q=80",
    specs: [
      "Chịu nhiệt tới: -9°C",
      "Lông vũ 650FP kháng ẩm",
      "Nén gọn cỡ bình nước 1.5L",
    ],
    description:
      "Túi ngủ giữ ấm cao cấp thích hợp cho sương muối và gió lạnh buốt trên đỉnh núi.",
    rating: 4.9,
  },
  {
    id: "eq-light-01",
    name: "Đèn Pin Đeo Đầu Siêu Sáng Petzl Actik Core (450 Lumens)",
    category: "Accessories",
    dailyRate: 35000,
    deposit: 400000,
    stock: 30,
    imageUrl:
      "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&w=500&q=80",
    specs: [
      "Độ sáng: 450 Lumens",
      "Chiếu xa 100m",
      "Chống nước IPX4, sạc Micro-USB",
    ],
    description:
      "Đèn pin chuyên dụng hành quân đêm, có chế độ đèn đỏ tránh làm chói mắt đồng đội.",
    rating: 4.8,
  },
];

export const mockRentalOrders: RentalOrder[] = [
  {
    id: "ord-rent-8842",
    tripId: "trip-tanang-01",
    tripName: "Tà Năng – Phan Dũng (3N2Đ)",
    items: [
      { item: mockEquipment[0], quantity: 1 }, // Lều 2 người
    ],
    days: 3,
    totalRentalFee: 270000,
    totalDeposit: 800000,
    totalPayment: 1070000,
    status: "READY_FOR_DELIVERY",
    createdAt: "08/10/2026",
  },
];

export const initialLiveTelemetry: LiveNavTelemetry = {
  distanceCompletedKm: 8.4,
  totalDistanceKm: 14.5,
  elapsedTimeString: "03h 45m",
  averageSpeedKmh: 2.3,
  currentElevationM: 840,
  elevationGainM: 320,
  activeCheckpointsCompleted: 1,
  totalCheckpoints: 5,
  nextCheckpointName: "Cột mốc Đồi Lính",
  nextCheckpointDistanceM: 180,
  batteryPercent: 86,
  gpsAccuracyMeters: 3,
  offlineSyncSec: 15,
  isOnRoute: false, // Off route by default to demonstrate the critical deviation warning!
  deviationMeters: 120, // 120m away from planned trail
  isWarningDismissed: false,
};
