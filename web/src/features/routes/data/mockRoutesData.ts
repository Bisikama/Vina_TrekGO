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
    name: "Núi Bà Đen - Cung Đường Cột Điện",
    location: "Thành phố Tây Ninh, Tỉnh Tây Ninh",
    totalElevation: "986m",
    totalDistance: "4.5 km",
    duration: "1 Ngày (6 - 8 Tiếng)",
    difficulty: {
      level: "medium",
      label: "Trung bình khá",
      color: "bg-emerald-600 text-white"
    },
    rating: "4.9",
    reviewsCount: 348,
    coverImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
    mapImage: "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop",
    elevationProfileImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop",
    description: "Chinh phục 'Nóc nhà Nam Bộ' ở độ cao 986m theo cung đường Cột Điện huyền thoại. Tuyến đường rợp bóng cây với 117 cột điện dẫn lối qua rừng nguyên sinh, thung lũng đá và chạm đỉnh chóp kim loại ngắm trọn vẹn biển mây đồng bằng Tây Ninh.",
    checkpoints: [
      {
        id: "cp1",
        name: "Cột 1 - Chân núi (Điểm xuất phát)",
        elevation: "42m",
        distanceFromStart: "0 km",
        description: "Bắt đầu hành trình tại chân núi Bà Đen cạnh quán nước tiếp tế, chuẩn bị gậy leo và nước khoáng.",
        type: "start"
      },
      {
        id: "cp2",
        name: "Cột 55 - Trạm nghỉ chân giữa sườn núi",
        elevation: "535m",
        distanceFromStart: "2.3 km",
        description: "Khu vực phiến đá lớn râm mát dưới tán rừng, điểm dừng tiếp nước, ăn nhẹ và bổ sung điện giải.",
        type: "rest"
      },
      {
        id: "cp3",
        name: "Cột 100 - Bậc đá dốc cao",
        elevation: "820m",
        distanceFromStart: "3.8 km",
        description: "Đoạn dốc đá gồ ghề đòi hỏi bám rễ cây và giữ thăng bằng cẩn thận trước khi lên sống núi thoai thoải.",
        type: "rest"
      },
      {
        id: "cp4",
        name: "Đỉnh Núi Bà Đen - Chóp inox 986m",
        elevation: "986m",
        distanceFromStart: "4.5 km",
        description: "Chạm chóp mốc 986m 'Nóc nhà Nam Bộ', săn mây Tây Ninh và chiêm bái Đại tượng Phật Bà Tây Bổ Đà Sơn.",
        type: "peak"
      }
    ],
    upcomingTripIds: ["trip-1", "trip-2"]
  },
  {
    id: "nui-ba-den",
    name: "Núi Bà Đen - Cung Đường Cột Điện",
    location: "Thành phố Tây Ninh, Tỉnh Tây Ninh",
    totalElevation: "986m",
    totalDistance: "4.5 km",
    duration: "1 Ngày (6 - 8 Tiếng)",
    difficulty: {
      level: "medium",
      label: "Trung bình khá",
      color: "bg-emerald-600 text-white"
    },
    rating: "4.9",
    reviewsCount: 348,
    coverImage: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop",
    mapImage: "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop",
    elevationProfileImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop",
    description: "Chinh phục 'Nóc nhà Nam Bộ' ở độ cao 986m theo cung đường Cột Điện huyền thoại. Tuyến đường rợp bóng cây với 117 cột điện dẫn lối qua rừng nguyên sinh, thung lũng đá và chạm đỉnh chóp kim loại ngắm trọn vẹn biển mây đồng bằng Tây Ninh.",
    checkpoints: [
      {
        id: "cp1",
        name: "Cột 1 - Chân núi (Điểm xuất phát)",
        elevation: "42m",
        distanceFromStart: "0 km",
        description: "Bắt đầu hành trình tại chân núi Bà Đen cạnh quán nước tiếp tế, chuẩn bị gậy leo và nước khoáng.",
        type: "start"
      },
      {
        id: "cp2",
        name: "Cột 55 - Trạm nghỉ chân giữa sườn núi",
        elevation: "535m",
        distanceFromStart: "2.3 km",
        description: "Khu vực phiến đá lớn râm mát dưới tán rừng, điểm dừng tiếp nước, ăn nhẹ và bổ sung điện giải.",
        type: "rest"
      },
      {
        id: "cp3",
        name: "Cột 100 - Bậc đá dốc cao",
        elevation: "820m",
        distanceFromStart: "3.8 km",
        description: "Đoạn dốc đá gồ ghề đòi hỏi bám rễ cây và giữ thăng bằng cẩn thận trước khi lên sống núi thoai thoải.",
        type: "rest"
      },
      {
        id: "cp4",
        name: "Đỉnh Núi Bà Đen - Chóp inox 986m",
        elevation: "986m",
        distanceFromStart: "4.5 km",
        description: "Chạm chóp mốc 986m 'Nóc nhà Nam Bộ', săn mây Tây Ninh và chiêm bái Đại tượng Phật Bà Tây Bổ Đà Sơn.",
        type: "peak"
      }
    ],
    upcomingTripIds: ["trip-1", "trip-2"]
  }

];
