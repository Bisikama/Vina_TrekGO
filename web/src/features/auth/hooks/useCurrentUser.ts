"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { getCurrentUserApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { User } from "../types/auth.types";

export const useCurrentUser = () => {
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<User | null>(user);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.setUser);

  const getCurrentUser = async (force = false): Promise<User | null> => {
    const cachedUser = useAuthStore.getState().user;
    if (cachedUser && !force) {
      setData(cachedUser);
      return cachedUser;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getCurrentUserApi();
      setData(response);
      setUser(response);
      return response;
    } catch (err: unknown) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message || err.message
          : err instanceof Error
            ? err.message
            : "Không thể lấy thông tin người dùng.";
      setError(Array.isArray(message) ? message.join(", ") : message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { getCurrentUser, data: data ?? user, isLoading, error };
};
