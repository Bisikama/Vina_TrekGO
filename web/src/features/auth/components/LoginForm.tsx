"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useLogin } from "../hooks/useLogin";

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
  const { login, isLoading, error: apiError } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"trekker" | "leader" | "warehouse" | "admin">("trekker");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!email || !password) {
      setValidationError("Vui lòng nhập địa chỉ Email và Mật khẩu.");
      return;
    }

    const result = await login({ email, password });
    if (result) {
      // Set mock cookie for middleware to read
      document.cookie = "mock_token=valid_mock_token; path=/; max-age=3600";
      
      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = "/";
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Header Link */}
      <div className="flex justify-end mb-10">
        <span className="text-sm text-gray-700">
          Bạn là Leader mới?{" "}
          <Link
            href="/public/register-leader"
            className="font-bold text-[#154B36] hover:underline cursor-pointer underline-offset-4"
          >
            Đăng ký kiểm định
          </Link>
        </span>
      </div>

      {/* Lock Icon */}
      <div className="w-12 h-12 bg-[#F0FDF4] rounded-2xl flex items-center justify-center border border-[#DCFCE7] mb-6">
        <svg className="w-6 h-6 text-[#154B36]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>

      {/* Title & Subtitle */}
      <h2 className="text-3xl sm:text-[32px] font-extrabold text-[#0F172A] tracking-tight mb-3">
        Đăng nhập hệ thống
      </h2>
      <p className="text-sm text-gray-600 mb-8 max-w-[90%] leading-relaxed">
        Truy cập tài khoản Trekker, Leader, Quản lý kho hoặc Điều hành viên
      </p>

      {/* Role Tabs */}
      <div className="mb-8">
        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
          Chọn cổng phân quyền truy cập
        </label>
        <div className="grid grid-cols-4 gap-2 bg-[#F8FAFC] p-1.5 rounded-2xl border border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setActiveTab("trekker")}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all ${
              activeTab === "trekker" 
                ? "bg-[#154B36] text-white shadow-md" 
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="text-xs font-semibold">Trekker</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leader")}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all ${
              activeTab === "leader" 
                ? "bg-[#154B36] text-white shadow-md" 
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs font-semibold">Leader</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("warehouse")}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all ${
              activeTab === "warehouse" 
                ? "bg-[#154B36] text-white shadow-md" 
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-xs font-semibold text-center leading-tight">Kho<br/>thiết bị</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("admin")}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all ${
              activeTab === "admin" 
                ? "bg-[#154B36] text-white shadow-md" 
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <svg className="w-5 h-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-xs font-semibold">Điều hành</span>
          </button>
        </div>
      </div>

      {/* Alert Error Box */}
      {(validationError || apiError) && (
        <div className="mb-6 p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-xl text-[#B91C1C] flex items-start gap-3 relative">
          <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 className="text-sm font-bold">Đăng nhập không thành công</h4>
            <p className="text-[13px] mt-1 opacity-90">{validationError || apiError || "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại thông tin hoặc khôi phục mật khẩu."}</p>
          </div>
          <button className="absolute top-4 right-4 text-red-400 hover:text-red-600" onClick={() => {setValidationError(null)}}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[13px] font-bold text-[#1E293B]">
              Email hoặc Mã định danh Trekker
            </label>
            <span className="text-[11px] font-semibold text-red-600">Thông tin bắt buộc</span>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="nguyen.van.an@expedition.vn"
              className={`w-full pl-11 pr-4 py-3.5 bg-[#F8FAFC] border rounded-xl text-[15px] text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition ${
                (validationError || apiError) ? "border-red-300 bg-red-50/30" : "border-[#E2E8F0]"
              }`}
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[13px] font-bold text-[#1E293B]">
              Mật khẩu
            </label>
            <Link href="/public/forgot-password" className="text-[12px] font-semibold text-[#154B36] hover:underline">
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="•••••••••••••••••"
              className={`w-full pl-11 pr-12 py-3.5 bg-[#F8FAFC] border rounded-xl text-[15px] text-[#0F172A] placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#154B36] outline-none transition ${
                (validationError || apiError) ? "border-red-300 bg-red-50/30" : "border-[#E2E8F0]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
              )}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center justify-between text-sm pt-1">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                defaultChecked
                className="peer h-[18px] w-[18px] appearance-none rounded border border-gray-300 bg-white checked:border-[#154B36] checked:bg-[#154B36] transition cursor-pointer"
              />
              <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-gray-700 font-medium group-hover:text-gray-900 transition">Ghi nhớ đăng nhập trên thiết bị này</span>
          </label>
          <div className="flex items-center gap-1.5 text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <span className="text-[11px] font-semibold">256-bit SSL</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 px-4 bg-[#154B36] hover:bg-[#0D3425] disabled:bg-gray-400 text-white font-extrabold rounded-xl shadow-lg shadow-[#154B36]/20 transition-all flex items-center justify-center gap-2 text-[15px] cursor-pointer mt-2"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Đang xác thực...
            </span>
          ) : (
            <>
              <span>Đăng nhập vào hệ thống</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </>
          )}
        </button>
      </form>

      {/* Quick Mock Login Accounts (Development only) */}
      <div className="mt-8 border border-dashed border-gray-300 rounded-xl p-4 bg-gray-50/50">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">Tài khoản thử nghiệm nhanh</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <button 
            type="button"
            onClick={async () => { 
              setEmail("trekker@example.com"); setPassword("123456"); setActiveTab("trekker");
              const result = await login({ email: "trekker@example.com", password: "123456" });
              if (result) {
                document.cookie = "mock_token=valid_mock_token; path=/; max-age=3600";
                if (onSuccess) onSuccess();
                else window.location.href = "/";
              }
            }}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-[#154B36] hover:text-white hover:border-[#154B36] transition-colors"
          >
            Trekker
          </button>
          <button 
            type="button"
            onClick={async () => { 
              setEmail("leader@example.com"); setPassword("123456"); setActiveTab("leader");
              const result = await login({ email: "leader@example.com", password: "123456" });
              if (result) {
                document.cookie = "mock_token=valid_mock_token; path=/; max-age=3600";
                if (onSuccess) onSuccess();
                else window.location.href = "/";
              }
            }}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-[#154B36] hover:text-white hover:border-[#154B36] transition-colors"
          >
            Leader
          </button>
          <button 
            type="button"
            onClick={async () => { 
              setEmail("warehouse@example.com"); setPassword("123456"); setActiveTab("warehouse");
              const result = await login({ email: "warehouse@example.com", password: "123456" });
              if (result) {
                document.cookie = "mock_token=valid_mock_token; path=/; max-age=3600";
                if (onSuccess) onSuccess();
                else window.location.href = "/";
              }
            }}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-[#154B36] hover:text-white hover:border-[#154B36] transition-colors"
          >
            Kho
          </button>
          <button 
            type="button"
            onClick={async () => { 
              setEmail("admin@example.com"); setPassword("123456"); setActiveTab("admin");
              const result = await login({ email: "admin@example.com", password: "123456" });
              if (result) {
                document.cookie = "mock_token=valid_mock_token; path=/; max-age=3600";
                if (onSuccess) onSuccess();
                else window.location.href = "/";
              }
            }}
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-[#154B36] hover:text-white hover:border-[#154B36] transition-colors"
          >
            Điều hành
          </button>
        </div>
      </div>

      {/* Footer Signup Link */}
      <div className="mt-8 text-center text-[13px] font-medium text-gray-700">
        Chưa có tài khoản Trekking System?{" "}
        <Link href="/public/register" className="font-bold text-[#154B36] hover:underline underline-offset-4">
          Đăng ký ngay
        </Link>
      </div>

      {/* Bottom Legal Terms */}
      <div className="mt-12 text-center border-t border-gray-100 pt-6">
        <p className="text-[11px] text-gray-500 max-w-sm mx-auto leading-relaxed">
          Bằng việc đăng nhập, bạn đồng ý với{" "}
          <Link href="/public/terms" className="underline hover:text-gray-800">Điều khoản dịch vụ</Link>{" "}
          &{" "}
          <Link href="/public/safety" className="underline hover:text-gray-800">Quy chuẩn an toàn leo núi</Link>{" "}
          của Trekking System.
        </p>
        
        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-gray-500 font-semibold">
          <div className="flex items-center gap-1.5 text-red-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>SOS Cứu hộ: 1800-9988 (24/7)</span>
          </div>
          <span className="text-gray-300">•</span>
          <span>Phiên bản v2.4.8-PRO</span>
        </div>
      </div>
    </div>
  );
};

