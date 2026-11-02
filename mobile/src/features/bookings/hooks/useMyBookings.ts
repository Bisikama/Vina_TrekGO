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
      const rawItems = res.items || [];
      // Tải chi tiết cho các booking active/checked-in để lấy trip.status thực tế từ backend
      const enrichedItems = await Promise.all(
        rawItems.map(async (b) => {
          if (["CONFIRMED", "CHECKED_IN", "PARTIAL_CHECKIN"].includes(b.status)) {
            try {
              const detail = await bookingApiService.getBookingDetail(b.id);
              if (detail?.trip?.status) {
                return {
                  ...b,
                  trip: {
                    ...b.trip,
                    status: detail.trip.status,
                  },
                };
              }
            } catch {
              // giữ nguyên tóm tắt nếu không tải được chi tiết
            }
          }
          return b;
        }),
      );
      setBookings(enrichedItems);
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
