export enum UserRole {
  USER = 'USER',
  LEADER = 'LEADER',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export interface User {
  id: string;
  email: string;
  fullName?: string;
  name?: string;
  phone?: string;
  cccd?: string;
  avatar?: string;
  role?: UserRole | string;
  status?: UserStatus | string;
  createdAt?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  avatar?: string;
  role?: UserRole;
}

export interface RegisterResponse {
  message: string;
  email: string;
  userId: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
}

export interface LogoutPayload {
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
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

export interface LogoutResponse {
  message: string;
}

export interface BootstrapPayload {
  authUserId: string;
  email: string;
  fullName?: string;
  phone?: string | null;
  avatar?: string | null;
  role?: UserRole;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface OtpPayload {
  email: string;
  otp: string;
}

export interface ResendOtpPayload {
  email: string;
}

export interface MessageResponse {
  message: string;
  email?: string;
}

export interface ApiErrorResponse {
  message: string | string[];
  statusCode?: number;
  error?: string;
}
