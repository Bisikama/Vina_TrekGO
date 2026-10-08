"use client";

import { useState } from "react";
import { logoutApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { AxiosError } from "axios";

export const useLogout = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { refreshToken, logout: storeLogout } = useAuthStore();

  const logout = async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const tokenToRevoke = refreshToken || (typeof window !== "undefined" ? localStorage.getItem("vina_trekgo_refresh_token") : null);

    try {
      if (tokenToRevoke) {
        await logoutApi({ refreshToken: tokenToRevoke });
      }
      return true;
    } catch (err: unknown) {
      let errorMessage = "Lỗi khi gửi yêu cầu đăng xuất.";
      if (err instanceof AxiosError) {
        errorMessage = err.response?.data?.error?.message || err.message || errorMessage;
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
