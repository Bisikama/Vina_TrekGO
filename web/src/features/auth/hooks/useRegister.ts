"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { registerApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { AuthResponse, RegisterPayload } from "../types/auth.types";
import { AxiosError } from "axios";

export const useRegister = () => {
  const [formData, setFormData] = useState<RegisterPayload>({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    cccd: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AuthResponse | null>(null);

  const setAuth = useAuthStore((state) => state.setAuth);

  const register = async (payload?: RegisterPayload): Promise<AuthResponse | null> => {
    const payloadToSubmit = payload || formData;
    setIsLoading(true);
    setError(null);

    try {
      const response = await registerApi(payloadToSubmit);
      setData(response);
      setAuth(response.user, response.accessToken, response.refreshToken);
      return response;
    } catch (err: unknown) {
      let errorMessage = "Đã xảy ra lỗi không xác định khi đăng ký.";
      if (err instanceof AxiosError) {
        errorMessage = err.response?.data?.message || err.message || errorMessage;
        if (Array.isArray(errorMessage)) {
          errorMessage = errorMessage.join(", ");
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return await register();
  };

  const reset = () => {
    setFormData({ email: "", password: "", fullName: "", phone: "", cccd: "" });
    setError(null);
    setData(null);
    setIsLoading(false);
  };

  return {
    formData,
    setFormData,
    handleChange,
    handleSubmit,
    register,
    isLoading,
    error,
    data,
    reset,
  };
};
