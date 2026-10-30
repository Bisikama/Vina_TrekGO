import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi, AuthApiError } from "@/features/auth/api";
import { subscribeToAuthState } from "@/lib/api-client";
import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
} from "@/features/auth/storage";
import {
  AuthSession,
  AuthUser,
  MessageResponse,
  RegisterInput,
  RegisterResponse,
  StoredAuthState,
} from "@/features/auth/types";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<RegisterResponse>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  resendOtp: (email: string) => Promise<MessageResponse>;
  requestPasswordReset: (email: string) => Promise<MessageResponse>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toStoredState(session: AuthSession): StoredAuthState {
  return {
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    tokenType: session.tokenType,
  };
}

function isTrekGoMobileRole(role?: string) {
  return (
    !role ||
    role === "USER" ||
    role === "LEADER" ||
    role === "STAFF_INVENTORY" ||
    role === "STAFF_DELIVERY" ||
    role === "STAFF"
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredAuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistSession = useCallback(async (nextSession: AuthSession) => {
    if (!isTrekGoMobileRole(nextSession.user.role)) {
      throw new AuthApiError(
        "Tài khoản này không có quyền truy cập ứng dụng TrekGo Mobile.",
        403,
      );
    }

    const stored = toStoredState(nextSession);
    await writeStoredAuth(stored);
    setSession(stored);
  }, []);

  useEffect(() => {
    return subscribeToAuthState(setSession);
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const stored = await readStoredAuth();

      if (!stored) {
        if (active) setIsLoading(false);
        return;
      }

      if (!isTrekGoMobileRole(stored.user.role)) {
        await clearStoredAuth();
        if (active) {
          setSession(null);
          setIsLoading(false);
        }
        return;
      }

      if (active) setSession(stored);

      try {
        const user = await authApi.me(stored.accessToken);
        const latestStored = (await readStoredAuth()) ?? stored;
        const validated = { ...latestStored, user };
        await writeStoredAuth(validated);
        if (active) setSession(validated);
      } catch (error) {
        if (
          error instanceof AuthApiError &&
          error.status !== 0 &&
          error.status < 500
        ) {
          await clearStoredAuth();
          if (active) setSession(null);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const nextSession = await authApi.login(email.trim().toLowerCase(), password);
      await persistSession(nextSession);
      return nextSession.user;
    },
    [persistSession],
  );

  const register = useCallback((input: RegisterInput) => {
    return authApi.register({
      ...input,
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || undefined,
    });
  }, []);

  const verifyOtp = useCallback(
    async (email: string, otp: string) => {
      const nextSession = await authApi.verifyOtp(
        email.trim().toLowerCase(),
        otp.trim(),
      );
      await persistSession(nextSession);
    },
    [persistSession],
  );

  const resendOtp = useCallback((email: string) => {
    return authApi.resendOtp(email.trim().toLowerCase());
  }, []);

  const requestPasswordReset = useCallback((email: string) => {
    return authApi.forgotPassword(email.trim().toLowerCase());
  }, []);

  const signOut = useCallback(async () => {
    const accessToken = session?.accessToken;

    setSession(null);
    await clearStoredAuth();

    if (accessToken) {
      try {
        await authApi.logout(accessToken);
      } catch {
        // Local sign-out must still succeed when the API is unavailable.
      }
    }
  }, [session?.accessToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated: Boolean(session?.accessToken && session?.user),
      isLoading,
      signIn,
      register,
      verifyOtp,
      resendOtp,
      requestPasswordReset,
      signOut,
    }),
    [
      isLoading,
      register,
      requestPasswordReset,
      resendOtp,
      session,
      signIn,
      signOut,
      verifyOtp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
