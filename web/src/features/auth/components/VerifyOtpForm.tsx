"use client";

import { FormEvent, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useResendOtp } from "../hooks/useResendOtp";
import { useVerifyOtp } from "../hooks/useVerifyOtp";

export const VerifyOtpForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const verify = useVerifyOtp();
  const resend = useResendOtp();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await verify.verifyOtp({
      email: email.trim(),
      otp: otp.replace(/\D/g, ""),
    });
    if (response) router.push("/");
  };

  return (
    <div className="space-y-5">
      <h2 className="text-3xl font-extrabold text-[#0F172A]">Xác thực email</h2>
      <p className="text-sm text-gray-600">Nhập mã OTP 6 số đã được gửi tới email của bạn.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="w-full rounded-xl border border-gray-200 px-4 py-3" />
        <input type="text" inputMode="numeric" pattern="[0-9]{6}" required minLength={6} maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Mã OTP" className="w-full rounded-xl border border-gray-200 px-4 py-3" />
        {verify.error && <p className="text-sm text-red-600">{verify.error}</p>}
        <button type="submit" disabled={verify.isLoading} className="w-full rounded-xl bg-[#154B36] px-4 py-3 font-bold text-white disabled:bg-gray-400">
          {verify.isLoading ? "Đang xác thực..." : "Xác thực OTP"}
        </button>
      </form>
      <button type="button" disabled={resend.isLoading || !email} onClick={() => resend.resendOtp({ email })} className="w-full text-sm font-semibold text-[#154B36]">
        {resend.isLoading ? "Đang gửi lại..." : "Gửi lại mã OTP"}
      </button>
      {resend.data && <p className="text-center text-sm text-green-700">{resend.data.message}</p>}
      {resend.error && <p className="text-center text-sm text-red-600">{resend.error}</p>}
    </div>
  );
};
