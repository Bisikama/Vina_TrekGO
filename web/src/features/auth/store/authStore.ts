"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { User } from "../types/auth.types";
import { useStaticDataStore } from "@/lib/staticDataStore";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

const AUTH_COOKIE = "vina_trekgo_access_token";
const ROLE_COOKIE = "vina_trekgo_role";

const setAuthCookies = (accessToken: string | null, role: string | null) => {
  if (typeof document === "undefined") return;

  if (accessToken) {
    document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(accessToken)}; path=/; max-age=3600; samesite=lax`;
  } else {
    document.cookie = `${AUTH_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
  }

  if (role) {
    document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(role)}; path=/; max-age=3600; samesite=lax`;
  } else {
    document.cookie = `${ROLE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        setAuthCookies(accessToken, user.role ?? null);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      setTokens: (accessToken, refreshToken) => {
        setAuthCookies(accessToken, useAuthStore.getState().user?.role ?? null);
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      setUser: (user) => set({ user }),

      logout: () => {
        setAuthCookies(null, null);
        useStaticDataStore.getState().clearStaticCache();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "vina-trekgo-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          setAuthCookies(state.accessToken, state.user?.role ?? null);
        }
      },
    }
  )
);
