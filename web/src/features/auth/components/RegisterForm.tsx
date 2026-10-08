"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRegister } from "../hooks/useRegister";
import { VerifyRegistration } from './VerifyRegistration';

interface RegisterFormProps {
  onSuccess?: () => void;
}

export const RegisterForm = ({ onSuccess }: RegisterFormProps) => {
  const { register, isLoading, error: apiError } = useRegister();

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cccd, setCccd] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [agreeMedical, setAgreeMedical] = useState(true);

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

    if (!agreeTerms || !agreeMedical) {
      setValidationError("Bạn cần đồng ý với Điều khoản dịch vụ và Quy chuẩn an toàn leo núi.");
      return;
    }

    const result = await register({
      email,
      password,
      fullName,
      phone,
      cccd: cccd || undefined,
    });

    if (result) setVerificationEmail(result.email);
  };

  if (verificationEmail) return <VerifyRegistration email={verificationEmail} onSuccess={onSuccess} />;

  return (
    <div className="flex flex-col h-full justify-center">
      {/* Top Header Switch Link */}
      <div className="flex justify-end mb-8">
        <span className="text-sm text-gray-600">
          Đã có tài khoản?{" "}
          <Link
            href="/public/login"
            className="font-bold text-[#154B36] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            Đăng nhập ngay
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
        </span>
      </div>

      {/* Title & Subtitle */}
      <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
        Tạo tài khoản
      </h2>
      <p className="text-sm text-gray-500 mt-2 mb-8">
        Đăng ký thông tin định danh và liên hệ y tế khẩn cấp.
      </p>

      {/* Alert Error Box */}
      {(validationError || apiError) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{validationError || apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Họ và tên */}
          <div>
            <label className="block text-sm font-bold text-[#1E293B] mb-1.5">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Nguyễn Văn An"
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition"
              />
            </div>
          </div>

          {/* Ngày sinh */}
          <div>
            <label className="block text-sm font-bold text-[#1E293B] mb-1.5">
              Ngày sinh <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </span>
              <input
                type="text"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition"
              />
            </div>
          </div>

          {/* Số điện thoại */}
          <div>
            <label className="block text-sm font-bold text-[#1E293B] mb-1.5">
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="0912 345 678"
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-bold text-[#1E293B] mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition"
              />
            </div>
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-sm font-bold text-[#1E293B] mb-1.5">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full pl-10 pr-12 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu */}
          <div>
            <label className="block text-sm font-bold text-[#1E293B] mb-1.5">
              Xác nhận mật khẩu <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full pl-10 pr-12 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition"
              />
              {confirmPassword && confirmPassword === password && (
                <span className="absolute inset-y-0 right-0 pr-4 flex items-center text-emerald-600 font-bold">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CCCD (Tùy chọn) */}
        <div>
          <label className="block text-sm font-bold text-[#1E293B] mb-1.5">
            Số Căn Cước Công Dân <span className="text-gray-400 font-normal">(Tùy chọn)</span>
          </label>
          <input
            type="text"
            value={cccd}
            onChange={(e) => setCccd(e.target.value)}
            placeholder="012345678901"
            className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition"
          />
        </div>

        {/* Emergency Contact */}
        <div className="bg-[#FEF2F2] border border-red-200 p-4 rounded-xl mt-6">
          <div className="flex items-center gap-2 text-xs font-bold text-[#991B1B] uppercase mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span>Thông tin liên hệ khẩn cấp (Bắt buộc)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Người liên hệ khẩn cấp *
              </label>
              <input
                type="text"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Nguyễn Thị Mai (Chị ruột)"
                className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Số điện thoại khẩn cấp *
              </label>
              <input
                type="tel"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="0987 654 321"
                className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
          </div>
        </div>

        {/* Terms Checkboxes */}
        <div className="space-y-3 text-sm text-gray-600 pt-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-start">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="peer mt-0.5 h-5 w-5 appearance-none rounded-md border border-gray-300 bg-white checked:border-[#154B36] checked:bg-[#154B36] transition"
              />
              <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="leading-relaxed">
              Tôi đồng ý với <strong className="text-gray-800 group-hover:text-[#154B36] transition">Điều khoản dịch vụ</strong> và <strong className="text-gray-800 group-hover:text-[#154B36] transition">Quy chuẩn an toàn leo núi</strong>.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-start">
              <input
                type="checkbox"
                checked={agreeMedical}
                onChange={(e) => setAgreeMedical(e.target.checked)}
                className="peer mt-0.5 h-5 w-5 appearance-none rounded-md border border-gray-300 bg-white checked:border-[#154B36] checked:bg-[#154B36] transition"
              />
              <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="leading-relaxed">
              Cam kết cung cấp chính xác thông tin y tế và chấp hành mọi chỉ dẫn đảm bảo tính mạng của Leader đoàn.
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 px-4 bg-[#154B36] hover:bg-[#0D3425] disabled:bg-gray-400 text-white font-extrabold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base cursor-pointer mt-4"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Đang xử lý đăng ký...
            </span>
          ) : (
            <>
              <span>Tạo tài khoản Trekker</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
