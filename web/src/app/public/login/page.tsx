import { AuthLayout, LoginForm } from "@/features/auth";

export const metadata = {
  title: "Đăng Nhập Tài Khoản Trekker | Trekking System",
  description: "Nhập thông tin tài khoản của bạn để tiếp tục hành trình chinh phục.",
};

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
