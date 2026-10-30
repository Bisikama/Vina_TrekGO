import { useCallback, useEffect, useState } from "react";
import {
  bookingApiService,
  getBookingErrorMessage,
} from "../services/booking.api";
import type { BookingStatus, BookingSummary } from "../types";

export function useMyBookings(initialStatus?: BookingStatus | string) {
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(50);
  const [status, setStatus] = useState<string>(initialStatus || "");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await bookingApiService.listMyBookings({
        page,
        pageSize,
        ...(status ? { status } : {}),
      });
      setBookings(res.items || []);
      setTotal(res.total || 0);
    } catch (err: unknown) {
      const errInfo = getBookingErrorMessage(
        err,
        "Không thể tải danh sách đặt chỗ.",
      );
      setError(errInfo.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, status]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const handleSetStatus = useCallback((newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
  }, []);

  return {
    bookings,
    total,
    page,
    pageSize,
    isLoading,
    error,
    status,
    setStatus: handleSetStatus,
    setPage,
    refetch: fetchBookings,
  };
}
