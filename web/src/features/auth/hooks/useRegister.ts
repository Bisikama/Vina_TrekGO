"use client";

import { useState } from "react";
import { registerApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { RegisterPayload } from "../types/auth.types";

export const useRegister = (onSuccess?: () => void) => {
  const { setAuth } = useAuthStore();
  const [formData, setFormData] = useState<RegisterPayload>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Vui lòng nhập họ và tên");
      return;
    }
    if (!formData.email.trim()) {
      setError("Vui lòng nhập địa chỉ email");
      return;
    }
    if (formData.password.length < 6) {
      setError("Mật khẩu phải chứa ít nhất 6 ký tự");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await registerApi(formData);
      setAuth(response.user, response.token);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    isLoading,
    error,
    handleChange,
    handleSubmit,
  };
};
