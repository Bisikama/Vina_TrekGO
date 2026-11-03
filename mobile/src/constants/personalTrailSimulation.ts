/** GPS giả lập nội bộ, chỉ dành cho personal trail trong bản development. */
export interface SimulationPoint {
  latitude: number;
  longitude: number;
  altitudeM?: number;
}
export interface PersonalTrailSimulationConfig {
  region: string;
  route: {
    id: string;
    name: string;
    speed: number; // mét/giây, lớn hơn 0 và không quá 4.5 để qua bộ lọc trekking
    points: SimulationPoint[]; // ít nhất 2 điểm; không phải thứ tự [longitude, latitude]
  };
  accuracyM: number;
  intervalMs: number;
  altitudeM: number; // độ cao mặc định nếu điểm không có altitudeM
}

export const PERSONAL_TRAIL_SIMULATION: PersonalTrailSimulationConfig = {
  region: "Tây Ninh",
  route: {
    id: "ba-den-demo",
    name: "Núi Bà Đen — route giả lập",
    speed: 1.4, // 1.4 m/s ≈ 5 km/h
    // Các điểm tổng hợp để test, không phải cung trekking đã kiểm chứng.
    points: [
      { latitude: 11.3789, longitude: 106.1712 },
      { latitude: 11.3795, longitude: 106.1715 },
      { latitude: 11.3801, longitude: 106.1713 },
      { latitude: 11.3808, longitude: 106.1709 },
      { latitude: 11.3816, longitude: 106.1705 },
      { latitude: 11.38238, longitude: 106.17022 },
    ],
  },
  accuracyM: 5, // mét; trên 25 m sẽ bị bộ lọc GPS loại
  intervalMs: 1000, // nhịp phát mẫu, mili giây
  altitudeM: 900, // độ cao cố định để test, không phải độ cao thực hoặc AWS DEM
};
