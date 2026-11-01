import { StaffRentalProducts } from "@/features/rentals/components/staff/StaffRentalProducts";

// Dùng form thật (API staff/rental-products) thay cho RentalManagement (dữ liệu mẫu cứng).
// ADMIN đặt giá trị thay thế, tiền cọc và hạng sản phẩm tại đây (RB-POL-03).
export default function RentalsPage() {
  return <StaffRentalProducts variant="admin" />;
}
