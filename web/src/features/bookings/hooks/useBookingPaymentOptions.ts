'use client';

import { useCallback, useEffect, useState } from 'react';
import { bookingApi, bookingError } from '../booking.api';
import type { PaymentOption } from '../types/booking.types';

export function useBookingPaymentOptions(enabled = true) {
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function load() {
      try {
        const result = await bookingApi.paymentOptions();
        if (!active) return;
        // Preserve the current web restriction on MoMo; only offer enabled gateways.
        setOptions(result.gateways.filter((option) => option.gateway !== 'momo'));
        setError('');
      } catch (cause) {
        if (!active) return;
        setOptions([]);
        setError(bookingError(cause).message || 'Không thể tải phương thức thanh toán.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt, enabled]);

  return { options, loading, error, retry };
}
