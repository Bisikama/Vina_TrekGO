import { AuthResponse, LoginPayload } from "../types/auth.types";
// import { apiClient } from "@/lib/axios";

export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  // Real API call example:
  // const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  // return data;

  // Mock API call for demo:
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (payload.email && payload.password === "password123") {
        resolve({
          user: {
            id: "u-101",
            email: payload.email,
            name: "John Doe",
          },
          token: "mock-jwt-token-xyz123",
        });
      } else {
        reject(new Error("Invalid email or password (use password: password123)"));
      }
    }, 1000);
  });
};
