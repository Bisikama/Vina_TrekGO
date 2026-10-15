'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { bookingApi, bookingError, dateTime, money, statusLabels } from '../booking.api';
import type { Booking, PaymentGateway, PaymentOption } from '../booking.api';
import { BookingSignIn } from './BookingSignIn';

const gatewayLabels: Record<string, string> = { momo: 'MoMo', vnpay: 'VNPAY' };

export function BookingCheckout({ bookingId }: { bookingId: string }) {
  const { accessToken } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [gateway, setGateway] = useState<PaymentGateway>('vnpay');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    bookingApi.paymentOptions().then(({ gateways }) => {
      if (!active) return;
      setOptions(gateways);
      setGateway((current) => gateways.some((item) => item.gateway === current) ? current : gateways[0]?.gateway ?? 'vnpay');
    }).catch((e) => { if (active) setError(bookingError(e).message); });
    return () => { active = false; };
  }, [accessToken, retry]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const next = await bookingApi.detail(bookingId);
        if (!active) return;
        setBooking(next);
        setExpired(new Date(next.expiresAt).getTime() <= Date.now());
        if (next.status === 'PENDING_PAYMENT') timer = setTimeout(refresh, 4000);
      } catch (e) { if (active) setError(bookingError(e).message); }
    };
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [accessToken, bookingId, retry]);

  const pay = async () => {
    if (!booking || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      // Retain the key across reloads and unknown network outcomes. A new
      // terminal attempt changes paymentId and therefore gets a new key.
      const storageKey = `booking-payment:${bookingId}:${gateway}:${booking.paymentSummary?.paymentId ?? 'first'}`;
      let key = sessionStorage.getItem(storageKey);
      if (!key) { key = crypto.randomUUID(); sessionStorage.setItem(storageKey, key); }
      const result = await bookingApi.pay(bookingId, key, gateway);
      if (result.checkout?.url && ['PENDING', 'PROCESSING'].includes(result.status)) {
        window.location.assign(result.checkout.url);
      } else {
        setBooking(await bookingApi.detail(bookingId));
      }
    } catch (e) {
      setError(bookingError(e).message);
      setRetry((value) => value + 1);
    } finally { submitting.current = false; setBusy(false); }
  };

  const payment = booking?.paymentSummary;
  const pending = !!payment && ['PENDING', 'PROCESSING'].includes(payment.status);
  const paid = payment?.status === 'SUCCEEDED';
  const canPay = booking?.status === 'PENDING_PAYMENT' && !expired && !pending && !paid;
  const confirmed = booking?.status === 'CONFIRMED';

  return <main className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28">
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/bookings" className="text-green-900 underline">← Đặt chỗ của tôi</Link>
      <h1 className="text-3xl font-bold">Thanh toán đặt chỗ</h1>
      {!accessToken ? <BookingSignIn /> : <>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={() => { setError(''); setRetry((value) => value + 1); }}>Tải lại</button></p>}
        {!booking && !error && <p role="status">Đang tải đặt chỗ…</p>}
        {booking && <>
          <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
            <p className="font-semibold text-green-800">{statusLabels[booking.status] ?? booking.status}</p>
            <h2 className="text-2xl font-semibold">{booking.trip.title}</h2>
            <p>{dateTime(booking.trip.startAt)} · {booking.participantCount} người</p>
            <p className="text-2xl font-bold text-green-900">{money(booking.totalAmount)}</p>
            <p className="text-sm text-stone-600">Mã đặt chỗ: {booking.id}</p>
            {booking.status === 'PENDING_PAYMENT' && <p>Hạn giữ chỗ: {dateTime(booking.expiresAt)}</p>}
          </section>
          <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm" aria-live="polite">
            {confirmed && <p className="font-semibold text-green-800">Thanh toán đã được ghi nhận. Đặt chỗ của bạn đã được xác nhận.</p>}
            {!confirmed && paid && <p>{payment?.applicationStatus === 'REJECTED' ? 'Đã nhận thanh toán nhưng đặt chỗ không thể xác nhận. Vui lòng liên hệ hỗ trợ để kiểm tra giao dịch.' : 'Đã nhận thanh toán. Server đang kiểm tra và xác nhận đặt chỗ.'}</p>}
            {pending && <>
              <p>Đang chờ kết quả từ {gatewayLabels[payment?.gateway ?? ''] ?? 'cổng thanh toán'}. Trang sẽ tự cập nhật sau khi server nhận kết quả.</p>
              {!expired && payment?.checkout?.url && <a href={payment.checkout.url} className="inline-block rounded-lg bg-green-900 px-5 py-3 font-semibold text-white">Tiếp tục thanh toán</a>}
              <p className="text-sm text-stone-600">Vui lòng chờ giao dịch hiện tại có kết quả trước khi đổi cổng thanh toán.</p>
            </>}
            {expired && !confirmed && !paid && <p>Thời gian giữ chỗ đã hết. Nếu đã thanh toán, vui lòng chờ server cập nhật hoặc liên hệ hỗ trợ.</p>}
            {canPay && <>
              {payment && <p>Giao dịch trước chưa thành công. Bạn có thể chọn cổng và thử lại.</p>}
              <fieldset disabled={busy} className="space-y-3">
                <legend className="mb-3 text-lg font-semibold">Chọn cổng thanh toán</legend>
                {(['momo', 'vnpay'] as const).map((name) => {
                  const enabled = options.some((item) => item.gateway === name);
                  return <label key={name} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${gateway === name && enabled ? 'border-green-800 bg-green-50' : 'border-stone-200'} ${!enabled ? 'opacity-50' : ''}`}>
                    <input type="radio" name="gateway" value={name} checked={gateway === name && enabled} disabled={!enabled} onChange={() => setGateway(name)} />
                    <span className="font-semibold">{gatewayLabels[name]}</span>
                    <span className="ml-auto text-sm">{enabled ? options.find((item) => item.gateway === name)?.environment === 'SANDBOX' ? 'Môi trường thử nghiệm' : '' : 'Chưa khả dụng'}</span>
                  </label>;
                })}
              </fieldset>
              <button disabled={busy || !options.some((item) => item.gateway === gateway)} onClick={pay} className="w-full rounded-xl bg-green-900 px-5 py-3 font-semibold text-white disabled:opacity-50">
                {busy ? 'Đang tạo giao dịch…' : `Thanh toán ${money(booking.totalAmount)} qua ${gatewayLabels[gateway]}`}
              </button>
            </>}
          </section>
        </>}
      </>}
    </div>
  </main>;
}
