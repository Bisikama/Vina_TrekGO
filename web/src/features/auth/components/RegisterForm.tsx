"use client";

import React from "react";
import { useRegister } from "../hooks/useRegister";
import { useAuthStore } from "../store/authStore";

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm = ({ onSuccess, onSwitchToLogin }: RegisterFormProps) => {
  const { formData, isLoading, error, handleChange, handleSubmit } = useRegister(onSuccess);
  const { user, isAuthenticated, logout } = useAuthStore();

  if (isAuthenticated && user) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg border border-[#E5E7EB] text-center">
        <div className="w-12 h-12 rounded-full bg-[#DCFCE7] text-[#166534] flex items-center justify-center mx-auto mb-3 text-xl font-bold">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-[#1F2937] mb-1">
          Chào mừng, {user.name}!
        </h2>
        <p className="text-sm text-[#6B7280] mb-6">
          Đã đăng nhập với email <span className="font-semibold text-[#2F6B4F]">{user.email}</span>
        </p>
        <button
          onClick={logout}
          className="w-full py-2.5 px-4 bg-[#DC2626] hover:bg-red-700 text-white font-medium rounded-lg shadow transition text-sm cursor-pointer"
        >
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg border border-[#E5E7EB]">
      <div className="text-center mb-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#F59E0B] bg-[#FEF3C7] px-2.5 py-1 rounded-full">
          Gia nhập cộng đồng Trekker
        </span>
        <h2 className="text-2xl font-bold text-[#1F2937] mt-2">
          Tạo tài khoản VinaTrekGO
        </h2>
        <p className="text-xs text-[#6B7280] mt-1">
          Khám phá và chinh phục những đỉnh núi đẹp nhất Việt Nam
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="register-name" 
            className="block text-xs font-semibold uppercase text-[#1F2937] mb-1"
          >
            Họ và tên
          </label>
          <input
            id="register-name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder="Nguyễn Văn A"
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#2F6B4F] focus:border-[#2F6B4F] outline-none text-[#1F2937] placeholder-gray-400 text-sm transition"
          />
        </div>

        <div>
          <label 
            htmlFor="register-email" 
            className="block text-xs font-semibold uppercase text-[#1F2937] mb-1"
          >
            Địa chỉ Email
          </label>
          <input
            id="register-email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="trekker@vinatrekgo.vn"
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#2F6B4F] focus:border-[#2F6B4F] outline-none text-[#1F2937] placeholder-gray-400 text-sm transition"
          />
        </div>

        <div>
          <label 
            htmlFor="register-phone" 
            className="block text-xs font-semibold uppercase text-[#1F2937] mb-1"
          >
            Số điện thoại (tùy chọn)
          </label>
          <input
            id="register-phone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="0912345678"
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#2F6B4F] focus:border-[#2F6B4F] outline-none text-[#1F2937] placeholder-gray-400 text-sm transition"
          />
        </div>

        <div>
          <label 
            htmlFor="register-password" 
            className="block text-xs font-semibold uppercase text-[#1F2937] mb-1"
          >
            Mật khẩu
          </label>
          <input
            id="register-password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="Tối thiểu 6 ký tự"
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#2F6B4F] focus:border-[#2F6B4F] outline-none text-[#1F2937] placeholder-gray-400 text-sm transition"
          />
        </div>

        <div>
          <label 
            htmlFor="register-confirmPassword" 
            className="block text-xs font-semibold uppercase text-[#1F2937] mb-1"
          >
            Xác nhận mật khẩu
          </label>
          <input
            id="register-confirmPassword"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            placeholder="Nhập lại mật khẩu"
            className="w-full px-3.5 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#2F6B4F] focus:border-[#2F6B4F] outline-none text-[#1F2937] placeholder-gray-400 text-sm transition"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 bg-[#2F6B4F] hover:bg-[#1F4A36] disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center text-sm cursor-pointer"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Đang đăng ký...
            </span>
          ) : (
            "Đăng Ký Tài Khoản"
          )}
        </button>
      </form>

      {onSwitchToLogin && (
        <div className="mt-5 text-center text-xs text-[#6B7280]">
          Đã có tài khoản?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-[#2F6B4F] hover:underline cursor-pointer"
          >
            Đăng nhập ngay
          </button>
        </div>
      )}
    </div>
  );
};
