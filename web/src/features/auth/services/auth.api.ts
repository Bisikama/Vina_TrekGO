import { apiClient } from "@/lib/axios";
import {
  AuthResponse,
  BootstrapPayload,
  ForgotPasswordPayload,
  LoginPayload,
  LogoutPayload,
  LogoutResponse,
  MessageResponse,
  OtpPayload,
  RefreshTokenPayload,
  RefreshTokenResponse,
  RegisterPayload,
  RegisterResponse,
  ResendOtpPayload,
  User,
} from "../types/auth.types";

/**
 * POST /api/v1/auth/register - Đăng ký tài khoản người dùng mới.
 * The API sends an OTP; the account is activated by verifyOtpApi.
 */
export const registerApi = async (payload: RegisterPayload): Promise<RegisterResponse> => {
  const { data } = await apiClient.post<RegisterResponse>("/api/v1/auth/register", payload);
  return data;
};

/**
 * POST /api/v1/auth/login - Đăng nhập vào hệ thống.
 */
export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>("/api/v1/auth/login", payload);
  return data;
};

/**
 * POST /api/v1/auth/refresh-token - Làm mới Access Token.
 */
export const refreshTokenApi = async (
  payload: RefreshTokenPayload
): Promise<RefreshTokenResponse> => {
  const { data } = await apiClient.post<RefreshTokenResponse>(
    "/api/v1/auth/refresh-token",
    payload
  );
  return data;
};

/**
 * POST /api/v1/auth/logout - Đăng xuất khỏi hệ thống.
 */
export const logoutApi = async (payload: LogoutPayload): Promise<LogoutResponse> => {
  const { data } = await apiClient.post<LogoutResponse>("/api/v1/auth/logout", payload);
  return data;
};

/**
 * GET /api/v1/auth/me - Lấy profile của user hiện tại.
 */
export const getCurrentUserApi = async (): Promise<User> => {
  const { data } = await apiClient.get<User>("/api/v1/auth/me");
  return data;
};

/**
 * POST /api/v1/auth/bootstrap - Đồng bộ profile từ identity provider.
 */
export const bootstrapAuthProfileApi = async (
  payload: BootstrapPayload
): Promise<User> => {
  const { data } = await apiClient.post<User>("/api/v1/auth/bootstrap", payload);
  return data;
};

/**
 * POST /api/v1/auth/reset-forgot-password - Gửi email đặt lại mật khẩu.
 */
export const forgotPasswordApi = async (
  payload: ForgotPasswordPayload
): Promise<MessageResponse> => {
  const { data } = await apiClient.post<MessageResponse>(
    "/api/v1/auth/reset-forgot-password",
    payload
  );
  return data;
};

/**
 * POST /api/v1/auth/verify-otp - Xác thực OTP và tạo session.
 */
export const verifyOtpApi = async (payload: OtpPayload): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>(
    "/api/v1/auth/verify-otp",
    payload
  );
  return data;
};

/**
 * POST /api/v1/auth/resend-otp - Gửi lại OTP xác thực email.
 */
export const resendOtpApi = async (
  payload: ResendOtpPayload
): Promise<MessageResponse> => {
  const { data } = await apiClient.post<MessageResponse>(
    "/api/v1/auth/resend-otp",
    payload
  );
  return data;
};
