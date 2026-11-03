"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { resendOtpApi } from "../services/auth.api";
import { MessageResponse, ResendOtpPayload } from "../types/auth.types";

export const useResendOtp = () => {
  const [data, setData] = useState<MessageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resendOtp = async (
    payload: ResendOtpPayload
  ): Promise<MessageResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await resendOtpApi(payload);
      setData(response);
      return response;
    } catch (err: unknown) {
      const responseData = err instanceof AxiosError ? err.response?.data : undefined;
      const message =
        responseData?.error?.message ||
        responseData?.message ||
        (err instanceof Error ? err.message : "Không thể gửi lại mã OTP.");
      setError(Array.isArray(message) ? message.join(", ") : message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { resendOtp, data, isLoading, error };
};
