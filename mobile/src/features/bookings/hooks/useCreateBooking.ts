import { useCallback, useRef, useState } from "react";
import {
  bookingApiService,
  generateIdempotencyKey,
} from "@/features/bookings/services/booking.api";
import type { BookingDetail, Participant } from "@/features/bookings/types";
import { ApiError } from "@/lib/api-client";

export interface CreateBookingInput {
  participantCount: number;
  participants: Participant[];
}

export type Booking = BookingDetail;

export function useCreateBooking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);

  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setErrorCode(null);
    setBooking(null);
    idempotencyKeyRef.current = generateIdempotencyKey();
  }, []);

  const regenerateKey = useCallback(() => {
    idempotencyKeyRef.current = generateIdempotencyKey();
  }, []);

  const submitBooking = useCallback(
    async (
      tripId: string,
      input: CreateBookingInput,
      _accessToken?: string,
    ): Promise<BookingDetail> => {
      setLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        const result = await bookingApiService.createBooking(
          tripId,
          input.participants,
          idempotencyKeyRef.current,
        );
        setBooking(result);
        return result;
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          setErrorCode(err.code || null);
          throw err;
        }

        const fallback = "Không thể gửi yêu cầu đặt chỗ. Vui lòng thử lại.";
        setError(fallback);
        throw new Error(fallback);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    submitBooking,
    loading,
    error,
    errorCode,
    booking,
    reset,
    regenerateKey,
  };
}
