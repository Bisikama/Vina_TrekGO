"use client";

import React, { useState } from "react";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: "login" | "register";
  onClose: () => void;
}

export const AuthModal = ({ isOpen, initialMode = "login", onClose }: AuthModalProps) => {
  const [mode, setMode] = useState<"login" | "register">(initialMode);

  // Sync mode when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scaleUp border border-[#E5E7EB]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition cursor-pointer"
          aria-label="Đóng"
        >
          ✕
        </button>

        {/* Tab Header */}
        <div className="flex border-b border-[#E5E7EB] bg-[#F8F9FF]">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 cursor-pointer ${
              mode === "login"
                ? "border-[#2F6B4F] text-[#2F6B4F] bg-white"
                : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
            }`}
          >
            Đăng Nhập
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 cursor-pointer ${
              mode === "register"
                ? "border-[#2F6B4F] text-[#2F6B4F] bg-white"
                : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
            }`}
          >
            Đăng Ký
          </button>
        </div>

        {/* Form Body */}
        <div className="p-2">
          {mode === "login" ? (
            <LoginForm 
              onSuccess={onClose} 
            />
          ) : (
            <RegisterForm 
              onSuccess={onClose} 
            />
          )}
        </div>
      </div>
    </div>
  );
};
