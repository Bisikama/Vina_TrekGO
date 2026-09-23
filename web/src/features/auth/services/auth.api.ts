import { apiClient } from "@/lib/axios";
import {
  AuthResponse,
  LoginPayload,
  LogoutPayload,
  LogoutResponse,
  RefreshTokenPayload,
  RefreshTokenResponse,
  RegisterPayload,
} from "../types/auth.types";

/**
 * POST /auth/register - Đăng ký tài khoản người dùng mới
 */
export const registerApi = async (payload: RegisterPayload): Promise<AuthResponse> => {
  // const { data } = await apiClient.post<AuthResponse>("/auth/register", payload);
  // return data;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        user: {
          id: "mock-user-id",
          email: payload.email,
          fullName: payload.fullName || "Trekker Mới",
          phone: payload.phone || "0987654321",
          role: payload.role || "USER",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
        },
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      });
    }, 1000);
  });
};

/**
 * POST /auth/login - Đăng nhập vào hệ thống
 */
export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  // const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  // return data;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (payload.email === "error@test.com") {
        reject(new Error("Sai email hoặc mật khẩu (Mock)"));
      } else {
        resolve({
          user: {
            id: "mock-user-id-123",
            email: payload.email,
            fullName: "Trekker Kì Cựu",
            phone: "0901234567",
            role: "USER",
            status: "ACTIVE",
            avatar: "https://i.pravatar.cc/150?u=mock",
            createdAt: new Date().toISOString(),
          },
          accessToken: "mock-access-token-login",
          refreshToken: "mock-refresh-token-login",
        });
      }
    }, 1000);
  });
};

/**
 * POST /auth/refresh-token - Làm mới Access Token
 */
export const refreshTokenApi = async (
  payload: RefreshTokenPayload
): Promise<RefreshTokenResponse> => {
  // const { data } = await apiClient.post<RefreshTokenResponse>("/auth/refresh-token", payload);
  // return data;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        accessToken: "mock-new-access-token",
        refreshToken: "mock-new-refresh-token",
      });
    }, 800);
  });
};

/**
 * POST /auth/logout - Đăng xuất khỏi hệ thống
 */
export const logoutApi = async (payload: LogoutPayload): Promise<LogoutResponse> => {
  // const { data } = await apiClient.post<LogoutResponse>("/auth/logout", payload);
  // return data;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ message: "Đăng xuất thành công (Mock)" });
    }, 500);
  });
};
