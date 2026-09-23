import { AuthLayout, RegisterForm } from "@/features/auth";

export const metadata = {
  title: "Tạo Tài Khoản Trekker Mới | Trekking System",
  description: "Đăng ký thông tin định danh và liên hệ y tế khẩn cấp phục vụ an toàn leo núi.",
};

export default function RegisterPage() {
  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
