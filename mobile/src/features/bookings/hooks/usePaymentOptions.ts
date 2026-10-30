import { useCallback, useEffect, useState } from "react";
import {
  bookingApiService,
  getBookingErrorMessage,
} from "../services/booking.api";
import type { PaymentOption } from "../types";

export function usePaymentOptions() {
  const [gateways, setGateways] = useState<PaymentOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await bookingApiService.getPaymentOptions();
      setGateways(res.gateways || []);
      return res.gateways;
    } catch (err: unknown) {
      const errInfo = getBookingErrorMessage(
        err,
        "Không thể tải danh sách cổng thanh toán.",
      );
      setError(errInfo.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  return {
    gateways,
    isLoading,
    error,
    refetch: fetchOptions,
  };
}
