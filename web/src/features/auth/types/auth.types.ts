export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
