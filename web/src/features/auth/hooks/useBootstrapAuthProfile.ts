"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { bootstrapAuthProfileApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { BootstrapPayload, User } from "../types/auth.types";

export const useBootstrapAuthProfile = () => {
  const [data, setData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);

  const bootstrap = async (payload: BootstrapPayload): Promise<User | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await bootstrapAuthProfileApi(payload);
      setData(response);
      setUser(response);
      return response;
    } catch (err: unknown) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message || err.message
          : err instanceof Error
            ? err.message
            : "Không thể đồng bộ hồ sơ người dùng.";
      setError(Array.isArray(message) ? message.join(", ") : message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { bootstrap, data, isLoading, error };
};
