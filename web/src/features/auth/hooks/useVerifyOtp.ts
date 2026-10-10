"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { verifyOtpApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { AuthResponse, OtpPayload } from "../types/auth.types";

export const useVerifyOtp = () => {
  const [data, setData] = useState<AuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((state) => state.setAuth);

  const verifyOtp = async (payload: OtpPayload): Promise<AuthResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await verifyOtpApi(payload);
      setData(response);
      setAuth(response.user, response.accessToken, response.refreshToken);
      return response;
    } catch (err: unknown) {
      const responseData = err instanceof AxiosError ? err.response?.data : undefined;
      const message =
        responseData?.error?.message ||
        responseData?.message ||
        (err instanceof Error ? err.message : "Mã OTP không hợp lệ hoặc đã hết hạn.");
      setError(Array.isArray(message) ? message.join(", ") : message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { verifyOtp, data, isLoading, error };
};
