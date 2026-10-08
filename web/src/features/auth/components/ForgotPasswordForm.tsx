"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useForgotPassword } from "../hooks/useForgotPassword";

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState("");
  const { forgotPassword, data, isLoading, error } = useForgotPassword();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await forgotPassword({ email });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-3xl font-extrabold text-[#0F172A]">Quên mật khẩu</h2>
      <p className="text-sm text-gray-600">Nhập email để nhận hướng dẫn đặt lại mật khẩu.</p>
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        className="w-full rounded-xl border border-gray-200 px-4 py-3"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && <p className="text-sm text-green-700">{data.message}</p>}
      <button type="submit" disabled={isLoading} className="w-full rounded-xl bg-[#154B36] px-4 py-3 font-bold text-white disabled:bg-gray-400">
        {isLoading ? "Đang gửi..." : "Gửi yêu cầu"}
      </button>
      <Link href="/public/login" className="block text-center text-sm font-semibold text-[#154B36]">
        Quay lại đăng nhập
      </Link>
    </form>
  );
};
