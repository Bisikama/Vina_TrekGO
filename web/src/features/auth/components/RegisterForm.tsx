"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRegister } from "../hooks/useRegister";
import { VerifyRegistration } from './VerifyRegistration';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm = ({ onSuccess, onSwitchToLogin }: RegisterFormProps) => {
  const router = useRouter();
  const { register, isLoading, error: apiError } = useRegister();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!email || !password || !fullName || !phone) {
      setValidationError("Vui lòng điền đầy đủ các thông tin bắt buộc (*).");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Mật khẩu xác nhận không trùng khớp.");
      return;
    }

    const result = await register({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      phone: phone.replace(/\s/g, "").trim(),
      avatar: avatar.trim() || undefined,
    });

    if (result) {
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/public/verify-otp?email=${encodeURIComponent(result.email)}`);
      }
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition";
  const labelClass = "block text-sm font-bold text-[#1E293B] mb-1.5";

  return (
    <div className="flex flex-col h-full justify-center">
      <div className="flex justify-end mb-8">
        <span className="text-sm text-gray-600">
          Đã có tài khoản?{" "}
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-bold text-[#154B36] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Đăng nhập ngay
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <Link
              href="/public/login"
              className="font-bold text-[#154B36] hover:underline inline-flex items-center gap-1"
            >
              Đăng nhập ngay <span aria-hidden="true">→</span>
            </Link>
          )}
        </span>
      </div>

      <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
        Tạo tài khoản
      </h2>
      <p className="text-sm text-gray-500 mt-2 mb-8">
        Đăng ký tài khoản TrekGO để bắt đầu hành trình.
      </p>

      {(validationError || apiError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
          {validationError || apiError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="register-fullName" className={labelClass}>
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              id="register-fullName"
              name="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              placeholder="Nguyễn Văn An"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="register-phone" className={labelClass}>
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input
              id="register-phone"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="0912 345 678"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="register-email" className={labelClass}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="register-password" className={labelClass}>
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Ít nhất 6 ký tự"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="register-confirm-password" className={labelClass}>
              Xác nhận mật khẩu <span className="text-red-500">*</span>
            </label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Nhập lại mật khẩu"
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="register-avatar" className={labelClass}>
              Avatar URL <span className="font-normal text-gray-400">(Tùy chọn)</span>
            </label>
            <input
              id="register-avatar"
              name="avatar"
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className={inputClass}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Sau khi đăng ký, mã OTP sẽ được gửi đến email của bạn để xác thực tài khoản.
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 px-4 bg-[#154B36] hover:bg-[#0D3425] disabled:bg-gray-400 text-white font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
        >
          {isLoading ? "Đang xử lý đăng ký..." : "Tạo tài khoản Trekker →"}
        </button>
      </form>
    </div>
  );
};
