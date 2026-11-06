'use client';

import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useAuth } from '@/features/auth';
import { Button, ErrorAlert, InfoBanner, StatusBadge, SurfaceCard } from '@/components/ui';
import { bookingApi, bookingError, dateTime, money } from '../booking.api';
import type { CancelBookingResponse } from '../types/booking.types';
import { BOOKING_POLL_TIMEOUT, isCancellationResultConsistent, isRefundNotRequired, mergeBookingRefunds, needsRefundTracking, REFUND_POLL_INTERVAL, REFUND_POLL_LIMIT, refundPurposeLabel, refundStatusLabel, type RefundBooking } from '../refund.utils';
import { BookingCancellationResult } from './BookingCancellationResult';

export function BookingRefunds({ bookingId, booking: initialBooking = null, cancellation = null }: {
  bookingId: string;
  booking?: RefundBooking | null;
  cancellation?: CancelBookingResponse | null;
}) {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const scope = `${user?.id ?? ''}:${bookingId}`;
  const [snapshot, setSnapshot] = useState<{ scope: string; booking: RefundBooking } | null>(null);
  const [error, setError] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const booking = snapshot?.scope === scope ? snapshot.booking : initialBooking;
  const enabled = !!cancellation || !!initialBooking?.refunds.length || initialBooking?.status === 'CANCELLED' || initialBooking?.paymentSummary?.applicationStatus === 'REJECTED';

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let reads = 0;
    const deadline = setTimeout(() => { clearTimeout(timer); controller.abort(); setIsPolling(false); }, BOOKING_POLL_TIMEOUT);
    async function refresh() {
      let pending = true;
      try {
        const next = await bookingApi.detail(bookingId, controller.signal);
        if (controller.signal.aborted) return;
        setSnapshot({ scope, booking: next });
        setError('');
        pending = needsRefundTracking(next, cancellation);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(bookingError(cause).message);
      }
      reads++;
      setIsPolling(pending && reads < REFUND_POLL_LIMIT);
      if (pending && reads < REFUND_POLL_LIMIT) timer = setTimeout(refresh, REFUND_POLL_INTERVAL);
      else clearTimeout(deadline);
    }
    void refresh();
    return () => { clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [bookingId, scope, enabled, cancellation, attempt]);

  const fingerprint = booking?.refunds.map((refund) => `${refund.refundId}:${refund.status}`).join(',');
  useEffect(() => {
    if (fingerprint) void mutate((key) => Array.isArray(key) && key[0] === 'booking-transactions' && key[1] === user?.id);
  }, [fingerprint, mutate, user?.id]);

  const refunds = mergeBookingRefunds(booking?.refunds ?? [], cancellation);
  const pending = needsRefundTracking(booking, cancellation);
  if (!enabled) return null;
  const reload = () => setAttempt((value) => value + 1);
  const related = cancellation?.refund ? refunds.find((refund) => refund.refundId === cancellation.refund?.refundId) : refunds.find((refund) => refund.purpose === 'BOOKING_CANCELLATION');
  const authoritative = booking?.refunds.some((refund) => refund.refundId === related?.refundId);
  const inconsistent = !!cancellation && !authoritative && !isCancellationResultConsistent(cancellation);
  return <SurfaceCard className="space-y-4" as="section">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Theo dõi khoản hoàn</h2><Button variant="outline" size="sm" onClick={reload} loading={isPolling}>Tải lại</Button></div>
    {cancellation && <BookingCancellationResult result={related && authoritative ? { ...cancellation, refund: related, refundProcessingStatus: related.status === 'SUCCEEDED' ? 'COMPLETED' : 'PENDING' } : cancellation} />}
    {error && <ErrorAlert message={error} onRetry={reload} />}
    {pending && <InfoBanner title="Khoản hoàn đang xử lý">{refunds.length ? 'Hệ thống đang cập nhật trạng thái khoản hoàn.' : 'Đang xác minh trạng thái khoản hoàn. Chưa có bản ghi hoàn không có nghĩa là bạn không được hoàn.'}{!isPolling && ' Bạn có thể tải lại để kiểm tra tiếp.'}</InfoBanner>}
    {!pending && !refunds.length && !isRefundNotRequired(cancellation) && <InfoBanner>Chưa có thông tin khoản hoàn.</InfoBanner>}
    {refunds.map((refund) => {
      return <article key={refund.refundId} className="space-y-2 rounded-xl border border-[#E5E7EB] p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="tabular-nums">{money(refund.amount)}</strong><StatusBadge status={inconsistent ? 'PENDING' : refund.status === 'SUCCEEDED' ? 'ACTIVE' : refund.status === 'FAILED' ? 'CANCELLED' : 'PENDING'} customLabel={inconsistent ? 'Đang xác minh khoản hoàn' : refundStatusLabel(refund.status)} /></div>
        <p>{refundPurposeLabel(refund.purpose)}</p>
        {refund.refundedAt && <p className="text-xs text-[#6B7280]">Thời điểm ghi nhận: {dateTime(refund.refundedAt)}</p>}
        {refund.reconciliationRequired && <p className="text-xs text-amber-800">Khoản hoàn cần tiếp tục kiểm tra đối soát.</p>}
        <p className="break-all font-mono text-[11px] text-[#6B7280]">Mã hoàn: {refund.refundId}</p>
      </article>;
    })}
  </SurfaceCard>;
}
