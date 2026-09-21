export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  phone?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
