import { create } from "zustand";
import { User } from "../types/auth.types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  initializeFromStorage: () => void;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: "vina_trekgo_access_token",
  REFRESH_TOKEN: "vina_trekgo_refresh_token",
  USER: "vina_trekgo_user",
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  setAuth: (user: User, accessToken: string, refreshToken: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
  },

  setTokens: (accessToken: string, refreshToken: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
    set({
      accessToken,
      refreshToken,
    });
  },

  setUser: (user: User) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    set({ user });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  initializeFromStorage: () => {
    if (typeof window === "undefined") return;

    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

      if (accessToken && refreshToken && storedUser) {
        const user = JSON.parse(storedUser);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      }
    } catch (err) {
      console.error("Failed to restore auth session from storage", err);
    }
  },
}));
