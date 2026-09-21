import { AuthResponse, LoginPayload, RegisterPayload } from "../types/auth.types";
// import { apiClient } from "@/lib/axios";

export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  // Real API call example:
  // const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  // return data;

  // Mock API call for demo:
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (payload.email && (payload.password === "password123" || payload.password.length >= 6)) {
        resolve({
          user: {
            id: "u-101",
            email: payload.email,
            name: payload.email.split("@")[0] || "Trekker",
          },
          token: "mock-jwt-token-xyz123",
        });
      } else {
        reject(new Error("Invalid email or password (use password: password123 or length >= 6)"));
      }
    }, 800);
  });
};

export const registerApi = async (payload: RegisterPayload): Promise<AuthResponse> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (payload.email && payload.name && payload.password) {
        resolve({
          user: {
            id: "u-" + Math.floor(Math.random() * 1000),
            email: payload.email,
            name: payload.name,
            phone: payload.phone,
          },
          token: "mock-jwt-token-reg-" + Date.now(),
        });
      } else {
        reject(new Error("Vui lòng điền đầy đủ thông tin đăng ký"));
      }
    }, 800);
  });
};
