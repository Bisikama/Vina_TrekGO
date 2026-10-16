'use client';

import { useCallback, useState } from 'react';
import { bookingApiService, getBookingErrorMessage } from '../services/booking.api';
import type {
  BookingDetail,
  Participant,
  PaymentCheckoutResponse,
  PaymentGateway,
  PaymentMethod,
} from '../types/booking.types';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function useBookingMutations() {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<{ message: string; code?: string; bookingId?: string } | null>(
    null
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createBooking = useCallback(
    async (
      tripId: string,
      participants: Participant[],
      customKey?: string
    ): Promise<BookingDetail> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const key = customKey || generateIdempotencyKey();
        const result = await bookingApiService.createBooking(tripId, participants, key);
        return result;
      } catch (err: unknown) {
        const errInfo = getBookingErrorMessage(err, 'Không thể tạo đặt chỗ.');
        setError(errInfo);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const updateParticipants = useCallback(
    async (
      bookingId: string,
      participants: Participant[],
      expectedVersion?: number
    ): Promise<BookingDetail> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await bookingApiService.updateParticipants(
          bookingId,
          participants,
          expectedVersion
        );
        return result;
      } catch (err: unknown) {
        const errInfo = getBookingErrorMessage(
          err,
          'Không thể cập nhật danh sách thành viên.'
        );
        setError(errInfo);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const createPayment = useCallback(
    async (
      bookingId: string,
      paymentMethod: PaymentMethod = 'REDIRECT',
      gateway?: PaymentGateway,
      customKey?: string
    ): Promise<PaymentCheckoutResponse> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const key = customKey || generateIdempotencyKey();
        const result = await bookingApiService.createPayment(bookingId, key, paymentMethod, gateway);
        return result;
      } catch (err: unknown) {
        const errInfo = getBookingErrorMessage(
          err,
          'Không thể khởi tạo cổng thanh toán.'
        );
        setError(errInfo);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const cancelBooking = useCallback(
    async (
      bookingId: string,
      reason: string,
      customKey?: string
    ): Promise<{ status: string }> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const key = customKey || generateIdempotencyKey();
        const result = await bookingApiService.cancelBooking(bookingId, reason, key);
        return result;
      } catch (err: unknown) {
        const errInfo = getBookingErrorMessage(err, 'Không thể hủy đặt chỗ.');
        setError(errInfo);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    createBooking,
    updateParticipants,
    createPayment,
    cancelBooking,
    isSubmitting,
    error,
    clearError,
  };
}
