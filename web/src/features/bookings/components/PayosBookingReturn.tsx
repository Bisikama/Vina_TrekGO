'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, ErrorAlert, InfoBanner, LoadingState, PageHeader, PageShell, SurfaceCard } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { bookingApi, bookingError, money } from '../booking.api';
import type { Booking } from '../booking.api';
import { getPayosBookingPaymentState, getPayosReturnBookingId } from '../payos-checkout';
import { BookingSignIn } from './BookingSignIn';
import { BookingRefunds } from './BookingRefunds';

export function PayosBookingReturn() {
  const params = useSearchParams();
  const { accessToken } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();
    async function refresh() {
      const id = getPayosReturnBookingId(params);
      if (!id) {
        if (active) {
          setError('Không tìm thấy đơn đặt chỗ của phiên thanh toán. Mở Đặt chỗ của tôi để kiểm tra.');
          setChecking(false);
        }
        return;
      }
      try {
        const next = await bookingApi.detail(id);
        if (!active) return;
        setBookingId(id);
        setBooking(next);
        setError('');
        const state = getPayosBookingPaymentState(next);
        const finished = state === 'CONFIRMED' || state === 'FAILED' ||
          (state === 'PAID' && next.paymentSummary?.applicationStatus === 'REJECTED');
        if (!finished && next.status === 'PENDING_PAYMENT' && Date.now() - startedAt < 60000) {
          timer = setTimeout(refresh, 3000);
        } else {
          setChecking(false);
        }
      } catch (cause) {
        if (active) { setError(bookingError(cause).message); setChecking(false); }
      }
    }
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [accessToken, params, attempt]);

  const state = getPayosBookingPaymentState(booking);
  const confirmed = state === 'CONFIRMED';
  const paid = state === 'PAID';
  const failed = state === 'FAILED';
  const cancelled = booking?.status === 'CANCELLED';
  const rejected = booking?.paymentSummary?.status === 'SUCCEEDED' && booking.paymentSummary.applicationStatus === 'REJECTED';
  const retry = () => { setChecking(true); setError(''); setAttempt((value) => value + 1); };

  return <PageShell maxWidth="sm">
    <PageHeader title="Kết quả thanh toán PayOS" description="Chuyển khoản ngân hàng bằng VietQR" />
    {!accessToken ? <BookingSignIn /> : <SurfaceCard className="space-y-5">
      {error && <ErrorAlert message={error} onRetry={retry} />}
      {cancelled ? <InfoBanner tone="warning" title="Đặt chỗ đã hủy">Theo dõi trạng thái khoản hoàn bên dưới.</InfoBanner>
        : rejected ? <InfoBanner tone="warning" title="Đã ghi nhận khoản thu, không áp dụng được vào đặt chỗ">Theo dõi khoản hoàn giao dịch kỹ thuật bên dưới.</InfoBanner>
        : confirmed ? <InfoBanner tone="success" title="Đặt chỗ đã được xác nhận">Thanh toán đã được hệ thống ghi nhận. Vé của bạn đã sẵn sàng.</InfoBanner>
        : paid ? <InfoBanner tone="warning" title="Đã nhận tiền, đang kiểm tra đặt chỗ">Hệ thống đang xử lý xác nhận vé. Nếu trạng thái chưa cập nhật, xem chi tiết đặt chỗ hoặc liên hệ hỗ trợ.</InfoBanner>
        : failed ? <InfoBanner tone="warning" title="Giao dịch chưa thành công">Cổng thanh toán đã ghi nhận giao dịch bị hủy, hết hạn hoặc thất bại. Mở đặt chỗ để kiểm tra và thử lại.</InfoBanner>
        : <InfoBanner title="Đang xác nhận thanh toán">Hệ thống đang kiểm tra số tiền nhận được. Nếu đã chuyển khoản, hãy chờ xác nhận và tránh chuyển thêm lần nữa.</InfoBanner>}
      {checking && !confirmed && !failed && !error && <LoadingState message={paid ? 'Đang xác nhận đặt chỗ...' : 'Đang kiểm tra giao dịch...'} className="p-4" />}
      {booking && <div className="space-y-2 text-sm">
        <p className="font-semibold">{booking.trip.title}</p>
        <p>Số tiền đặt chỗ: <span className="font-semibold tabular-nums">{money(booking.totalAmount)}</span></p>
      </div>}
      {booking && <BookingRefunds key={booking.id} bookingId={booking.id} booking={booking} />}
      {!checking && !confirmed && !failed && !error && <Button onClick={retry} variant="outline">Kiểm tra lại thanh toán</Button>}
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#2F6B4F]">
        {bookingId && <Link href={`/bookings/${bookingId}`}>Xem đặt chỗ</Link>}
        <Link href="/bookings">Đặt chỗ của tôi</Link>
      </div>
    </SurfaceCard>}
  </PageShell>;
}
