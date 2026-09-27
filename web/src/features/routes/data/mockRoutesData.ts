export interface Checkpoint {
  id: string;
  name: string;
  elevation: string;
  distanceFromStart: string;
  description: string;
  type: 'start' | 'camp' | 'peak' | 'rest' | 'end';
}

export interface RouteData {
  id: string;
  name: string;
  location: string;
  totalElevation: string;
  totalDistance: string;
  duration: string;
  difficulty: {
    level: string;
    label: string;
    color: string;
  };
  rating: string;
  reviewsCount: number;
  coverImage: string;
  mapImage: string; // Placeholder for GPS track
  elevationProfileImage: string; // Placeholder for elevation chart
  description: string;
  checkpoints: Checkpoint[];
  upcomingTripIds: string[]; // Tham chiếu tới các Trip
}

export const mockRoutesData: RouteData[] = [
  {
    id: "tx-khunglong",
    name: "Tà Xùa - Sống Lưng Khủng Long",
    location: "Bắc Yên, Sơn La",
    totalElevation: "2.865m",
    totalDistance: "14.5 km",
    duration: "3 Ngày 2 Đêm",
    difficulty: {
      level: "medium",
      label: "Trung bình",
      color: "bg-white text-gray-800"
    },
    rating: "4.9",
    reviewsCount: 158,
    coverImage: "https://images.unsplash.com/photo-1544885834-8b63a2327de8?q=80&w=1200&auto=format&fit=crop",
    mapImage: "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop", // Map placeholder
    elevationProfileImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop", // Chart placeholder
    description: "Đón bình minh trên biển mây cuồn cuộn ở độ cao 2.865m. Tà Xùa nổi tiếng với biển mây bồng bềnh và Sống Lưng Khủng Long kỳ vĩ. Điểm đến không thể bỏ qua của giới đam mê trekking phía Bắc.",
    checkpoints: [
      {
        id: "cp1",
        name: "Điểm xuất phát (Bản Công)",
        elevation: "1.250m",
        distanceFromStart: "0 km",
        description: "Điểm tập kết, làm thủ tục với biên phòng và bắt đầu leo.",
        type: "start"
      },
      {
        id: "cp2",
        name: "Lán nghỉ 1",
        elevation: "2.100m",
        distanceFromStart: "4.5 km",
        description: "Điểm dừng chân ăn trưa, lấy nước suối tự nhiên.",
        type: "rest"
      },
      {
        id: "cp3",
        name: "Sống Lưng Khủng Long",
        elevation: "2.650m",
        distanceFromStart: "7.2 km",
        description: "Đoạn đường dốc và hẹp nhất, hai bên là vách núi sâu.",
        type: "rest"
      },
      {
        id: "cp4",
        name: "Lán nghỉ 2 (Camp)",
        elevation: "2.800m",
        distanceFromStart: "8.5 km",
        description: "Khu vực cắm trại, ăn tối và nghỉ ngơi qua đêm. Nơi săn mây tuyệt đẹp.",
        type: "camp"
      },
      {
        id: "cp5",
        name: "Đỉnh Tà Xùa",
        elevation: "2.865m",
        distanceFromStart: "10.0 km",
        description: "Chạm đỉnh, check-in chóp inox và ngắm nhìn toàn cảnh biển mây.",
        type: "peak"
      }
    ],
    upcomingTripIds: ["trip-1", "trip-2"] // Liệt kê các ID chuyến đi đã có trong mockTripsData
  }
];
