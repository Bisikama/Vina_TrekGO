import type { AuthResponse, LoginPayload } from "../types/auth.types";
import { apiClient } from "@/lib/axios";

export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await apiClient.post<{ user: { id: string; email: string; fullName: string; role: string; avatarUrl?: string }; accessToken: string }>('/auth/login', payload);
  return { user: { ...data.user, name: data.user.fullName }, token: data.accessToken };
};
