import { TripListPage } from "@/features/trips/components/TripListPage";

export const metadata = {
  title: "Chuyến Đi Khởi Hành Sắp Tới - Trekking System",
  description: "Khám phá và đăng ký các chuyến đi trekking, leo núi được dẫn dắt bởi Leader chuyên nghiệp.",
};

export default function TripsRoute() {
  return <TripListPage />;
}
