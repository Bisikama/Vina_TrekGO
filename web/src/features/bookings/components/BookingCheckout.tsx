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
      const enabledGateways = gateways.filter((item) => item.gateway !== 'momo');
      setOptions(enabledGateways);
      setGateway((current) => enabledGateways.some((item) => item.gateway === current) ? current : enabledGateways[0]?.gateway ?? 'vnpay');
    }).catch((e) => { if (active) setError(bookingError(e).message); });
    return () => { active = false; };
  }, [accessToken, retry]);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('vnp_ResponseCode') || url.searchParams.has('resultCode')) {
        url.searchParams.set('bookingId', bookingId);
        window.location.replace(`/payment-return?${url.searchParams.toString()}`);
      }
    }
  }, [bookingId]);

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
        if (next.status === 'PENDING_PAYMENT') timer = setTimeout(refresh, 1200);
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
      <div>
        <Link
          href="/bookings"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-xs transition hover:bg-gray-50 hover:border-emerald-300 hover:text-[#125238] cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Đặt chỗ của tôi
        </Link>
      </div>

      <div className="pt-2">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          {confirmed ? 'Chi Tiết Đặt Chỗ & Vé Chuyến Đi' : 'Thanh toán đặt chỗ'}
        </h1>
        <p className="mt-1.5 text-xs text-gray-500">
          {confirmed
            ? 'Vé tham gia hành trình trekking của bạn đã được xác nhận thành công'
            : 'Hoàn tất thanh toán để đảm bảo vị trí và nhận vé tham gia đoàn'}
        </p>
      </div>
      {!hydrated ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-gray-100 space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-[#125238] border-t-transparent" />
          <p className="text-xs font-semibold text-gray-500">Đang tải dữ liệu đặt chỗ...</p>
        </div>
      ) : !accessToken ? <BookingSignIn /> : <>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={() => { setError(''); setRetry((value) => value + 1); }}>Tải lại</button></p>}
        {!booking && !error && <p role="status">Đang tải đặt chỗ…</p>}
        {booking && <>
          {/* Khối Thông Tin Chuyến Đi & Vé */}
          <section className="space-y-4 rounded-2xl bg-white p-6 sm:p-7 shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${confirmed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                {confirmed ? '✓ Đã xác nhận vé' : (statusLabels[booking.status] ?? booking.status)}
              </span>
              <span className="text-xs font-mono text-gray-400">Mã đặt: #{booking.id.substring(0, 8)}...</span>
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">{booking.trip.title}</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-400">Khởi hành:</span>
                  <span className="font-bold text-gray-900">{dateTime(booking.trip.startAt)}</span>
                </div>
                {booking.trip.endAt && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-400">Kết thúc:</span>
                    <span className="font-bold text-gray-900">{dateTime(booking.trip.endAt)}</span>
                  </div>
                )}
                {booking.pickup?.name && (
                  <div className="sm:col-span-2 flex items-start gap-2">
                    <span className="font-semibold text-gray-400 shrink-0">Điểm tập kết:</span>
                    <span className="font-medium text-gray-900">{booking.pickup.name} {booking.pickup.address ? `(${booking.pickup.address})` : ''}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-400">Số lượng:</span>
                  <span className="font-bold text-gray-900">{booking.participantCount} thành viên</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-400">Tổng tiền:</span>
                  <span className="font-extrabold text-emerald-700 text-sm">{money(booking.totalAmount)}</span>
                </div>
              </div>
            </div>

            {booking.status === 'PENDING_PAYMENT' && (
              <p className="text-xs text-amber-600 font-medium pt-2 border-t border-gray-100">
                Hạn giữ chỗ: {dateTime(booking.expiresAt)}
              </p>
            )}
          </section>

          {/* Nếu ĐÃ XÁC NHẬN: Hiển thị danh sách thành viên & nút hành trình */}
          {confirmed && (
            <>
              {booking.participants && booking.participants.length > 0 && (
                <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Danh sách thành viên tham gia ({booking.participants.length})
                  </h3>

                  <div className="divide-y divide-gray-100">
                    {booking.participants.map((p, index) => (
                      <div key={p.id || index} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{index + 1}. {p.fullName}</p>
                          <p className="text-gray-500 mt-0.5">SĐT: {p.phone || 'Chưa cung cấp'}</p>
                        </div>
                        {(p.emergencyContactName || p.emergencyContactPhone) && (
                          <div className="text-gray-500 text-[11px] sm:text-right">
                            <span className="font-medium text-gray-400">Liên hệ khẩn: </span>
                            {p.emergencyContactName} ({p.emergencyContactPhone})
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Nút hành động */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Link
                  href={`/trips/${booking.trip.id}`}
                  className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-[#125238] text-white font-bold text-xs text-center shadow-md shadow-emerald-900/10 hover:bg-[#2f6b4f] transition flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Xem Bản đồ Cung đường GPS 3D
                </Link>
                <Link
                  href="/my-trips"
                  className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-xs text-center hover:bg-gray-50 transition"
                >
                  Chuyến đi của tôi
                </Link>
              </div>
            </>
          )}

          {/* Phần thanh toán cho trạng thái PENDING */}
          {!confirmed && (
            <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-gray-100" aria-live="polite">
              {!confirmed && paid && <p>{payment?.applicationStatus === 'REJECTED' ? 'Đã nhận thanh toán nhưng đặt chỗ không thể xác nhận. Vui lòng liên hệ hỗ trợ để kiểm tra giao dịch.' : 'Đã nhận thanh toán. Server đang kiểm tra và xác nhận đặt chỗ.'}</p>}
              {pending && (
                <div className="flex items-center gap-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-4 sm:p-5 text-emerald-950">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#125238] border-t-transparent shrink-0" />
                  <div>
                    <p className="font-bold text-sm text-[#125238]">Đang đồng bộ kết quả từ {gatewayLabels[payment?.gateway ?? ''] ?? 'cổng thanh toán'}...</p>
                    <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                      Hệ thống đang kiểm tra giao dịch và tự động cập nhật đơn của bạn trong giây lát.
                    </p>
                  </div>
                </div>
              )}
              {expired && !confirmed && !paid && <p>Thời gian giữ chỗ đã hết. Nếu đã thanh toán, vui lòng chờ server cập nhật hoặc liên hệ hỗ trợ.</p>}
              {canPay && <>
                {payment && <p>Giao dịch trước chưa thành công. Bạn có thể chọn cổng và thử lại.</p>}
                <fieldset disabled={busy} className="space-y-3">
                  <legend className="mb-3 text-lg font-semibold">Chọn cổng thanh toán</legend>
                  {(['vnpay', 'momo'] as const).map((name) => {
                    const enabled = options.some((item) => item.gateway === name);
                    const isVnpay = name === 'vnpay';
                    return <label key={name} className={`flex cursor-pointer items-center gap-3.5 rounded-xl border p-4 transition ${gateway === name && enabled ? (isVnpay ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20' : 'border-[#A50064] bg-pink-50/50 ring-2 ring-[#A50064]/20') : 'border-stone-200 bg-white hover:border-stone-300'} ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input type="radio" name="gateway" value={name} checked={gateway === name && enabled} disabled={!enabled} onChange={() => setGateway(name)} className={`h-4 w-4 cursor-pointer ${isVnpay ? 'accent-[#125238]' : 'accent-[#A50064]'}`} />
                      <div className={`flex h-9 w-12 shrink-0 items-center justify-center rounded-lg font-black text-white text-[11px] shadow-xs ${isVnpay ? 'bg-[#005BAA]' : 'bg-[#A50064]'}`}>
                        {isVnpay ? 'VNPAY' : 'MoMo'}
                      </div>
                      <div>
                        <span className="font-bold text-gray-900">{isVnpay ? 'Cổng thanh toán VNPAY (QR / ATM / Visa)' : 'Ví điện tử MoMo (MoMo App / Quét QR)'}</span>
                        <p className="text-xs text-gray-500">{isVnpay ? 'Hỗ trợ quét mã VNPAY-QR 40+ ngân hàng, thẻ ATM, Visa/Mastercard' : 'Quét mã trực tiếp qua ứng dụng Ví MoMo'}</p>
                      </div>
                      {!enabled && <span className="ml-auto text-xs font-semibold text-gray-400">Chưa khả dụng</span>}
                    </label>;
                  })}
                </fieldset>
                <button disabled={busy || !options.some((item) => item.gateway === gateway)} onClick={pay} className="w-full rounded-xl bg-green-900 px-5 py-3 font-semibold text-white disabled:opacity-50">
                  {busy ? 'Đang tạo giao dịch…' : `Thanh toán ${money(booking.totalAmount)} qua ${gatewayLabels[gateway]}`}
                </button>
              </>}
            </section>
          )}
        </>}
      </>}
    </div>
  </main>;
}
