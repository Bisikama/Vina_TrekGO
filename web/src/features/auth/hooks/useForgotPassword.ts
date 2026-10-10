"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { forgotPasswordApi } from "../services/auth.api";
import { ForgotPasswordPayload, MessageResponse } from "../types/auth.types";

export const useForgotPassword = () => {
  const [data, setData] = useState<MessageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forgotPassword = async (
    payload: ForgotPasswordPayload
  ): Promise<MessageResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await forgotPasswordApi(payload);
      setData(response);
      return response;
    } catch (err: unknown) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message || err.message
          : err instanceof Error
            ? err.message
            : "Không thể gửi yêu cầu đặt lại mật khẩu.";
      setError(Array.isArray(message) ? message.join(", ") : message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { forgotPassword, data, isLoading, error };
};
