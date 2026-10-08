import { apiClient } from '@/lib/axios';
import type { AuthResponse, LoginPayload, LogoutPayload, LogoutResponse, RefreshTokenPayload, RefreshTokenResponse, RegisterPayload, RegisterResponse } from '../types/auth.types';
const config = { baseURL: '' };
export const registerApi = async (payload: RegisterPayload): Promise<RegisterResponse> => {
  const { email, password, fullName, phone } = payload;
  return (await apiClient.post<RegisterResponse>('/api/v1/auth/register', { email, password, fullName, ...(phone ? { phone } : {}) }, config)).data;
};
export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> =>
  (await apiClient.post<AuthResponse>('/api/v1/auth/login', payload, config)).data;
export const refreshTokenApi = async (payload: RefreshTokenPayload): Promise<RefreshTokenResponse> =>
  (await apiClient.post<RefreshTokenResponse>('/api/v1/auth/refresh-token', payload, config)).data;
export const logoutApi = async (payload: LogoutPayload): Promise<LogoutResponse> =>
  (await apiClient.post<LogoutResponse>('/api/v1/auth/logout', payload, config)).data;
export const verifyRegistrationApi = async (email: string, otp: string): Promise<AuthResponse> =>
  (await apiClient.post<AuthResponse>('/api/v1/auth/verify-otp', { email, otp }, config)).data;
export const resendRegistrationApi = async (email: string): Promise<{ message: string }> =>
  (await apiClient.post('/api/v1/auth/resend-otp', { email }, config)).data;
