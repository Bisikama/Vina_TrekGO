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
  cccd?: string;
  avatar?: string;
  role?: UserRole | string;
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
}

export interface RegisterResponse {
  message: string;
  email: string;
  userId: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LogoutResponse {
  message: string;
}

export interface ApiErrorResponse {
  message: string | string[];
  statusCode?: number;
  error?: string;
}
