"use client";

import React from "react";
import { useLogin } from "../hooks/useLogin";
import { useAuthStore } from "../store/authStore";

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export const LoginForm = ({ onSuccess, onSwitchToRegister }: LoginFormProps) => {
  const { formData, isLoading, error, handleChange, handleSubmit } = useLogin();
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    await handleSubmit(e);
    if (useAuthStore.getState().isAuthenticated && onSuccess) {
      onSuccess();
    }
  };

  if (isAuthenticated && user) {
    return (
      <div className="w-full max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg border border-[#E5E7EB] text-center">
        <div className="w-12 h-12 rounded-full bg-[#DCFCE7] text-[#166534] flex items-center justify-center mx-auto mb-3 text-xl font-bold">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-[#1F2937] mb-1">
          Xin chào, {user.name}!
        </h2>
        <p className="text-sm text-[#6B7280] mb-6">
          Đang đăng nhập với email <span className="font-semibold text-[#2F6B4F]">{user.email}</span>
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
        <span className="text-xs font-semibold uppercase tracking-wider text-[#2F6B4F] bg-[#DCFCE7] px-2.5 py-1 rounded-full">
          Cổng Trekker VinaTrekGO
        </span>
        <h2 className="text-2xl font-bold text-[#1F2937] mt-2">
          Đăng Nhập Tài Khoản
        </h2>
        <p className="text-xs text-[#6B7280] mt-1">
          Nhập thông tin tài khoản của bạn để tiếp tục
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="login-email" 
            className="block text-xs font-semibold uppercase text-[#1F2937] mb-1"
          >
            Địa chỉ Email
          </label>
          <input
            id="login-email"
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
          <div className="flex items-center justify-between mb-1">
            <label 
              htmlFor="login-password" 
              className="block text-xs font-semibold uppercase text-[#1F2937]"
            >
              Mật khẩu
            </label>
            <span className="text-xs text-[#6B7280]">(Demo: password123)</span>
          </div>
          <input
            id="login-password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            placeholder="••••••••"
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
              Đang xác thực...
            </span>
          ) : (
            "Đăng Nhập"
          )}
        </button>
      </form>

      {onSwitchToRegister && (
        <div className="mt-5 text-center text-xs text-[#6B7280]">
          Chưa có tài khoản?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-semibold text-[#2F6B4F] hover:underline cursor-pointer"
          >
            Đăng ký ngay
          </button>
        </div>
      )}
    </div>
  );
};
