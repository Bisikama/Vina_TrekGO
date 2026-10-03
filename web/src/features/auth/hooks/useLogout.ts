"use client";

import { useState } from "react";
import { logoutApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { AxiosError } from "axios";

export const useLogout = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshToken = useAuthStore((state) => state.refreshToken);
  const storeLogout = useAuthStore((state) => state.logout);

  const logout = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      if (refreshToken) {
        await logoutApi({ refreshToken });
      }
      return true;
    } catch (err: unknown) {
      let errorMessage = "Lỗi khi gửi yêu cầu đăng xuất.";
      if (err instanceof AxiosError) {
        errorMessage = err.response?.data?.message || err.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      return false;
    } finally {
      storeLogout();
      setIsLoading(false);
    }
  };

  return {
    logout,
    isLoading,
    error,
  };
};
