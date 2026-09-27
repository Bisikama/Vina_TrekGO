"use client";

import { useState } from "react";
import { refreshTokenApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { RefreshTokenResponse } from "../types/auth.types";
import { AxiosError } from "axios";

export const useRefreshToken = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { refreshToken: storedRefreshToken, setTokens, logout } = useAuthStore();

  const refresh = async (tokenOverride?: string): Promise<RefreshTokenResponse | null> => {
    const tokenToUse = tokenOverride || storedRefreshToken || localStorage.getItem("vina_trekgo_refresh_token");

    if (!tokenToUse) {
      setError("Không tìm thấy refresh token");
      logout();
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await refreshTokenApi({ refreshToken: tokenToUse });
      setTokens(response.accessToken, response.refreshToken);
      return response;
    } catch (err: unknown) {
      let errorMessage = "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.";
      if (err instanceof AxiosError) {
        errorMessage = err.response?.data?.message || err.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      logout();
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    refresh,
    isLoading,
    error,
  };
};
