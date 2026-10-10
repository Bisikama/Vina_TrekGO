"use client";

import { useAuthStore } from "../store/authStore";

export const useAuth = () => {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
  };
};
