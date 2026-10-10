import { Suspense } from "react";
import { AuthLayout, VerifyOtpForm } from "@/features/auth";

export default function VerifyOtpPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div>Đang tải...</div>}>
        <VerifyOtpForm />
      </Suspense>
    </AuthLayout>
  );
}
