import { apiRequest } from "@/lib/api-client";

import {
  AuthSession,
  AuthUser,
  MessageResponse,
  RefreshTokenResponse,
  RegisterInput,
  RegisterResponse,
} from "@/features/auth/types";

export {
  API_BASE_URL,
  ApiError as AuthApiError,
} from "@/lib/api-client";

export const authApi = {
  register: (input: RegisterInput) =>
    apiRequest<RegisterResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...input, role: "USER" }),
      fallbackMessages: { 409: "Email này đã được đăng ký." },
    }),

  login: (email: string, password: string) =>
    apiRequest<AuthSession>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      fallbackMessages: { 401: "Email hoặc mật khẩu không chính xác." },
    }),

  verifyOtp: (email: string, otp: string) =>
    apiRequest<AuthSession>("/api/v1/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  resendOtp: (email: string) =>
    apiRequest<MessageResponse>("/api/v1/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  forgotPassword: (email: string) =>
    apiRequest<MessageResponse>("/api/v1/auth/reset-forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  refresh: (refreshToken: string) =>
    apiRequest<RefreshTokenResponse>("/api/v1/auth/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  me: (accessToken: string) =>
    apiRequest<AuthUser>("/api/v1/auth/me", {
      method: "GET",
      accessToken,
    }),

  logout: (accessToken: string) =>
    apiRequest<MessageResponse>("/api/v1/auth/logout", {
      method: "POST",
      accessToken,
    }),
};
