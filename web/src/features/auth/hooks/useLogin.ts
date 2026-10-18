"use client";

import { useState, ChangeEvent, FormEvent } from "react";
import { preload } from "swr";
import { loginApi } from "../services/auth.api";
import { useAuthStore } from "../store/authStore";
import { AuthResponse, LoginPayload } from "../types/auth.types";
import { AxiosError } from "axios";
import { useStaticDataStore } from "@/lib/staticDataStore";
import { bookingApiService } from "@/features/bookings/services/booking.api";
import { privateTripsApi } from "@/features/trips/services/private-trips.api";

const prefetchAfterLogin = () => {
  // 1. Zustand: Prefetch static / rarely changing data (system trails, private sources)
  useStaticDataStore.getState().prefetchAllStaticData();

  // 2. SWR: Preload dynamic / frequently changing GET endpoints into memory cache
  void preload(["public-booking-trips", 1, 12, "", "", "", "", "", ""], () =>
    bookingApiService.getPublicTrips({ page: 1, pageSize: 12 })
  );
  void preload(["my-bookings", 1, 50, ""], () =>
    bookingApiService.listMyBookings({ page: 1, pageSize: 50 })
  );
  void preload(["my-bookings", 1, 10, ""], () =>
    bookingApiService.listMyBookings({ page: 1, pageSize: 10 })
  );
  void preload("private-trips", () => privateTripsApi.list());
};

export const useLogin = () => {
  const [formData, setFormData] = useState<LoginPayload>({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AuthResponse | null>(null);

  const setAuth = useAuthStore((state) => state.setAuth);

  const login = async (payload?: LoginPayload): Promise<AuthResponse | null> => {
    const payloadToSubmit = payload || formData;
    setIsLoading(true);
    setError(null);

    try {
      const response = await loginApi(payloadToSubmit);
      setData(response);
      setAuth(response.user, response.accessToken, response.refreshToken);
      prefetchAfterLogin();
      return response;
    } catch (err: unknown) {
      let errorMessage = "Tên đăng nhập hoặc mật khẩu không đúng.";
      if (err instanceof AxiosError) {
        errorMessage = err.response?.data?.error?.message || err.message || errorMessage;
        if (Array.isArray(errorMessage)) {
          errorMessage = errorMessage.join(", ");
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return await login();
  };

  const reset = () => {
    setFormData({ email: "", password: "" });
    setError(null);
    setData(null);
    setIsLoading(false);
  };

  return {
    formData,
    setFormData,
    handleChange,
    handleSubmit,
    login,
    isLoading,
    error,
    data,
    reset,
  };
};
