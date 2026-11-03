import { useCallback, useState } from "react";
import {
  bookingApiService,
  generateIdempotencyKey,
  getBookingErrorMessage,
  registerPaymentSessionCleanup,
} from "../services/booking.api";
import type {
  BookingDetail,
  CancelBookingResponse,
  Participant,
  PaymentCheckoutResponse,
  PaymentGateway,
  PaymentMethod,
} from "../types";

export interface BookingMutationError {
  message: string;
  code?: string;
  bookingId?: string;
}

// ─── Module-level cache: Giữ key bền vững kể cả khi Component bị unmount/re-render ───
const persistentPaymentKeys: Record<string, { key: string; createdAt: number }> = {};

export function clearPersistentPaymentKey(bookingId?: string) {
  if (!bookingId) {
    Object.keys(persistentPaymentKeys).forEach((k) => delete persistentPaymentKeys[k]);
    return;
  }
  Object.keys(persistentPaymentKeys).forEach((k) => {
    if (k.startsWith(`${bookingId}:`)) {
      delete persistentPaymentKeys[k];
    }
  });
}

// Đồng bộ cleanup từ API Service
registerPaymentSessionCleanup(clearPersistentPaymentKey);

export function useBookingMutations() {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<BookingMutationError | null>(null);

  const clearPaymentSession = useCallback((bookingId: string) => {
    clearPersistentPaymentKey(bookingId);
    bookingApiService.clearBookingPaymentSession(bookingId);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createBooking = useCallback(
    async (
      tripId: string,
      participants: Participant[],
      customKey?: string,
    ): Promise<BookingDetail> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const key = customKey || generateIdempotencyKey();
        const result = await bookingApiService.createBooking(
          tripId,
          participants,
          key,
        );
        return result;
      } catch (err: unknown) {
        const errInfo = getBookingErrorMessage(err, "Không thể tạo đặt chỗ.");
        setError(errInfo);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const updateParticipants = useCallback(
    async (
      bookingId: string,
      participants: Participant[],
      expectedVersion?: number,
    ): Promise<BookingDetail> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await bookingApiService.updateParticipants(
          bookingId,
          participants,
          expectedVersion,
        );
        return result;
      } catch (err: unknown) {
        const errInfo = getBookingErrorMessage(
          err,
          "Không thể cập nhật danh sách thành viên.",
        );
        setError(errInfo);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const createPayment = useCallback(
    async (
      bookingId: string,
      paymentMethod: PaymentMethod = "REDIRECT",
      gateway?: PaymentGateway,
      paymentIdHint?: string,
    ): Promise<PaymentCheckoutResponse> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const now = Date.now();
        // Gom key theo bookingId + gateway để nếu user bấm lại trong 14 phút sẽ gửi cùng 1 key
        const cacheKey = `${bookingId}:${gateway || "default"}:${paymentIdHint || "active"}`;
        const cached = persistentPaymentKeys[cacheKey];

        let key: string;
        // Nếu đã có key và chưa quá 14 phút thì dùng lại key cũ
        if (cached && now - cached.createdAt < 14 * 60 * 1000) {
          key = cached.key;
        } else {
          key = generateIdempotencyKey();
          persistentPaymentKeys[cacheKey] = { key, createdAt: now };
        }

        const result = await bookingApiService.createPayment(
          bookingId,
          key,
          paymentMethod,
          gateway,
        );
        return result;
      } catch (err: unknown) {
        const errInfo = getBookingErrorMessage(
          err,
          "Không thể khởi tạo cổng thanh toán.",
        );
        // Nếu lỗi do đổi phương thức hoặc xung đột payload / đang có attempt bị kẹt, xóa key này để lần sau tạo mới
        if (
          errInfo.code === "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD" ||
          errInfo.code === "PAYMENT_ATTEMPT_IN_PROGRESS"
        ) {
          const cacheKey = `${bookingId}:${gateway || "default"}:${paymentIdHint || "active"}`;
          delete persistentPaymentKeys[cacheKey];
        }
        setError(errInfo);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const cancelBooking = useCallback(
    async (
      bookingId: string,
      reason: string,
      customKey?: string,
    ): Promise<CancelBookingResponse> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const key = customKey || generateIdempotencyKey();
        const result = await bookingApiService.cancelBooking(
          bookingId,
          reason,
          key,
        );
        return result;
      } catch (err: unknown) {
        const errInfo = getBookingErrorMessage(err, "Không thể hủy đặt chỗ.");
        setError(errInfo);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    createBooking,
    updateParticipants,
    createPayment,
    cancelBooking,
    clearPaymentSession,
    isSubmitting,
    error,
    clearError,
  };
}