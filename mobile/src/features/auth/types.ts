export type AuthRole =
  | "USER"
  | "LEADER"
  | "ADMIN"
  | "STAFF_INVENTORY"
  | "STAFF_DELIVERY"
  | "STAFF";

export type AuthStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface AuthUser {
  id: string;
  email: string;
  fullName?: string | null;
  name?: string | null;
  phone?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  role?: AuthRole | string;
  status?: AuthStatus | string;
  createdAt?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: "USER";
}

export interface RegisterResponse {
  message: string;
  email: string;
  userId: string;
}

export interface MessageResponse {
  message: string;
  email?: string;
}

export interface StoredAuthState {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  tokenType?: string;
}
