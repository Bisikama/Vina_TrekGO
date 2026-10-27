'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/features/auth';
import { bookingApi, bookingError, dateTime, money, statusLabels } from '../booking.api';
import type { Booking, Participant, PaymentGateway, PaymentOption } from '../booking.api';
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

  // States cho modal QR & lời mời vé
  const [qrParticipant, setQrParticipant] = useState<Participant | null>(null);
  const [inviteParticipant, setInviteParticipant] = useState<Participant | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteModalError, setInviteModalError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState('');

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
        if (url.searchParams.has('vnp_ResponseCode') && url.searchParams.has('vnp_SecureHash')) {
          const vnpQuery = new URLSearchParams();
          url.searchParams.forEach((value, key) => {
            if (key.startsWith('vnp_')) {
              vnpQuery.set(key, value);
            }
          });
          fetch(`/api/v1/payments/webhooks/vnpay?${vnpQuery.toString()}`).catch(() => {});
        }
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
        if (next.status === 'PENDING_PAYMENT') timer = setTimeout(refresh, 3500);
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

  const handleSelfClaim = async (p: Participant) => {
    if (!p.id || !booking) return;
    setActionLoadingId(p.id);
    setError('');
    try {
      await bookingApi.selfClaim(booking.id, p.id);
      const updated = await bookingApi.detail(booking.id);
      setBooking(updated);
      setActionBanner(`Đã nhận vé thành công cho ${p.fullName}!`);
      setTimeout(() => setActionBanner(''), 4500);
    } catch (err: unknown) {
      setError(bookingError(err).message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteParticipant?.id || !booking || !inviteEmail.trim()) return;
    setActionLoadingId(inviteParticipant.id);
    setError('');
    setInviteModalError('');
    try {
      await bookingApi.invite(booking.id, inviteParticipant.id, inviteEmail.trim());
      const updated = await bookingApi.detail(booking.id);
      setBooking(updated);
      const recipient = inviteEmail.trim();
      setInviteParticipant(null);
      setInviteEmail('');
      setInviteModalError('');
      setActionBanner(`Đã gửi vé thành công tới ${recipient}!`);
      setTimeout(() => setActionBanner(''), 4500);
    } catch (err: unknown) {
      const msg = bookingError(err).message;
      setInviteModalError(msg);
      setError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevokeInvite = async (p: Participant) => {
    if (!p.pendingInvitationId || !booking) return;
    setActionLoadingId(p.id ?? 'revoke');
    setError('');
    try {
      await bookingApi.revokeInvitation(p.pendingInvitationId);
      const updated = await bookingApi.detail(booking.id);
      setBooking(updated);
      setActionBanner('Đã thu hồi lời mời thành công.');
      setTimeout(() => setActionBanner(''), 4500);
    } catch (err: unknown) {
      setError(bookingError(err).message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const payment = booking?.paymentSummary;
  const pending = !!payment && ['PENDING', 'PROCESSING'].includes(payment.status);
  const paid = payment?.status === 'SUCCEEDED';
  const canPay = booking?.status === 'PENDING_PAYMENT' && !expired && !pending && !paid;
  
  // Xác nhận đơn: bao gồm cả khi bắt đầu check-in hoặc đã hoàn thành
  const confirmed = ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'].includes(booking?.status ?? '');

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

      {actionBanner && (
        <div className="rounded-xl bg-[#125238] p-4 text-xs font-bold text-white shadow-sm flex items-center justify-between">
          <span>{actionBanner}</span>
          <button type="button" onClick={() => setActionBanner('')} className="text-white/80 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {!hydrated ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm border border-gray-100 space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-[#125238] border-t-transparent" />
          <p className="text-xs font-semibold text-gray-500">Đang tải dữ liệu đặt chỗ...</p>
        </div>
      ) : !accessToken ? (
        <BookingSignIn />
      ) : (
        <>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs font-medium text-red-700 shadow-xs">
              {error}
            </div>
          )}

          {booking && (
            <>
              {/* Thẻ thông tin chuyến đi & trạng thái đặt chỗ */}
              <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      Mã đặt chỗ #{booking.id.slice(0, 8)}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 mt-1">{booking.trip.title}</h2>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 self-start sm:self-auto">
                    {statusLabels[booking.status] ?? booking.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
                  <div>
                    <span className="text-gray-400 block">Thời gian khởi hành</span>
                    <strong className="text-gray-900 font-medium">{dateTime(booking.trip.startAt)} – {dateTime(booking.trip.endAt)}</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Điểm đón tập kết</span>
                    <strong className="text-gray-900 font-medium">{booking.pickup?.name || 'Điểm hẹn chung'}</strong>
                    {booking.pickup?.address && <p className="text-[11px] text-gray-400 truncate">{booking.pickup.address}</p>}
                  </div>
                  <div>
                    <span className="text-gray-400 block">Quy mô đặt vé</span>
                    <strong className="text-gray-900 font-medium">{booking.participantCount} thành viên</strong>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Tổng thanh toán</span>
                    <strong className="text-emerald-700 font-bold text-sm">{money(booking.totalAmount)} {booking.currency}</strong>
                  </div>
                </div>

                {booking.transport && booking.transport.length > 0 && booking.transport[0].plateNumber && (
                  <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs border border-slate-100">
                    <span className="text-slate-500 font-semibold block mb-1">Thông tin xe di chuyển:</span>
                    <p className="text-slate-800">
                      Biển số: <span className="font-bold">{booking.transport[0].plateNumber}</span>
                      {booking.transport[0].driverName && ` · Tài xế: ${booking.transport[0].driverName}`}
                      {booking.transport[0].driverPhone && ` (${booking.transport[0].driverPhone})`}
                    </p>
                  </div>
                )}
              </section>

              {/* Nếu ĐÃ XÁC NHẬN: Hiển thị danh sách thành viên & nút hành trình */}
              {confirmed && (
                <>
                  {booking.participants && booking.participants.length > 0 && (
                    <section className="space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Danh sách thành viên tham gia ({booking.participants.length})
                        </h3>
                        <span className="text-xs text-gray-500">Mã QR dùng để Leader điểm danh thực địa</span>
                      </div>

                      <div className="divide-y divide-gray-100">
                        {booking.participants.map((p, index) => {
                          const isCheckedIn = p.checkinStatus === 'CHECKED_IN';
                          const isNoShow = p.checkinStatus === 'NO_SHOW';
                          const isLoadingThis = actionLoadingId === p.id;

                          return (
                            <div key={p.id || index} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border-b border-gray-100 last:border-0">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-gray-900 text-sm">{index + 1}. {p.fullName}</p>

                                  {p.linkageStatus === 'CLAIMED' ? (
                                    <span className="inline-block text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      Tài khoản cá nhân
                                    </span>
                                  ) : p.linkageStatus === 'INVITATION_PENDING' ? (
                                    <span className="inline-block text-[10px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                      Đang mời: {p.recipientDisplay || 'Bạn đồng hành'}
                                    </span>
                                  ) : (
                                    <span className="inline-block text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                                      Chưa liên kết
                                    </span>
                                  )}

                                  {/* Badge trạng thái check-in */}
                                  {isCheckedIn ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      Đã điểm danh ({p.checkinMethod === 'QR' ? 'Quét QR' : 'Thủ công'})
                                    </span>
                                  ) : isNoShow ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                                      Vắng mặt
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                      Chưa điểm danh
                                    </span>
                                  )}
                                </div>

                                <p className="text-gray-500 text-[11px]">
                                  SĐT: <span className="text-gray-700 font-medium">{p.phone || 'Chưa cung cấp'}</span>
                                  {(p.emergencyContactName || p.emergencyContactPhone) && (
                                    <span className="ml-3">
                                      Liên hệ khẩn: <span className="text-gray-700">{p.emergencyContactName} ({p.emergencyContactPhone})</span>
                                    </span>
                                  )}
                                </p>

                                {isCheckedIn && p.checkedInAt && (
                                  <p className="text-[10px] text-gray-400">
                                    Điểm danh lúc: {new Date(p.checkedInAt).toLocaleString('vi-VN')}
                                  </p>
                                )}
                              </div>

                              {/* Nút hành động */}
                              <div className="flex items-center gap-2 flex-wrap shrink-0">
                                {/* Nút xem mã QR */}
                                {p.checkinCode && !isCheckedIn && !isNoShow && (
                                  <button
                                    type="button"
                                    onClick={() => setQrParticipant(p)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#125238] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#2f6b4f] transition cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                    </svg>
                                    Mã QR Check-in
                                  </button>
                                )}

                                {/* Nút tự nhận vé */}
                                {p.actions?.canSelfClaim && (
                                  <button
                                    type="button"
                                    disabled={isLoadingThis}
                                    onClick={() => handleSelfClaim(p)}
                                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-50 cursor-pointer"
                                  >
                                    {isLoadingThis ? '...' : 'Tự nhận vé'}
                                  </button>
                                )}

                                {/* Nút mời bạn bè */}
                                {p.actions?.canInvite && (
                                  <button
                                    type="button"
                                    disabled={isLoadingThis}
                                    onClick={() => { setInviteParticipant(p); setInviteEmail(''); setInviteModalError(''); }}
                                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                                  >
                                    Gửi vé cho bạn
                                  </button>
                                )}

                                {/* Nút thu hồi lời mời */}
                                {p.actions?.canRevoke && (
                                  <button
                                    type="button"
                                    disabled={isLoadingThis}
                                    onClick={() => handleRevokeInvite(p)}
                                    className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition disabled:opacity-50 cursor-pointer"
                                  >
                                    {isLoadingThis ? '...' : 'Thu hồi mời'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
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
            </>
          )}
        </>
      )}

      {/* MODAL HIỂN THỊ MÃ QR CHECK-IN */}
      {qrParticipant && qrParticipant.checkinCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                Mã vé #{qrParticipant.id?.slice(0, 8) || 'CHECKIN'}
              </span>
              <h3 className="text-lg font-bold text-gray-900 mt-1">Mã QR Điểm Danh Chuyến Đi</h3>
              <p className="text-xs text-gray-500 mt-0.5">{booking?.trip.title}</p>
            </div>

            <div className="mx-auto inline-flex flex-col items-center justify-center rounded-2xl border-2 border-emerald-100 bg-emerald-50/40 p-4 shadow-inner">
              <QRCodeSVG
                value={qrParticipant.checkinCode}
                size={220}
                fgColor="#125238"
                includeMargin
              />
              <p className="mt-2 text-[11px] font-mono font-bold text-emerald-900">
                {qrParticipant.fullName}
              </p>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Đưa mã QR này cho Trưởng đoàn (Leader) quét tại điểm đón tập kết để xác nhận có mặt.
            </p>

            <button
              type="button"
              onClick={() => setQrParticipant(null)}
              className="w-full rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
            >
              Đóng lại
            </button>
          </div>
        </div>
      )}

      {/* MODAL MỜI BẠN BÈ QUA EMAIL */}
      {inviteParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Gửi vé cho bạn đồng hành</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Chuyển vé của <span className="font-bold text-gray-800">{inviteParticipant.fullName}</span> sang tài khoản TrekGo riêng của bạn bè.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="invite-email-input" className="text-xs font-semibold text-gray-700 block">
                Email bạn đồng hành:
              </label>
              <input
                id="invite-email-input"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="vidu@gmail.com"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
              <p className="text-[11px] text-gray-400">
                Người nhận cần có tài khoản TrekGo để nhận vé. Không nhập email của chính bạn (dùng nút "Tự nhận vé" nếu là vé của bạn).
              </p>
              {inviteModalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] font-semibold text-red-700">
                  {inviteModalError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={!!actionLoadingId}
                onClick={() => { setInviteParticipant(null); setInviteEmail(''); }}
                className="rounded-xl bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={!inviteEmail.trim() || !!actionLoadingId}
                onClick={handleSendInvite}
                className="rounded-xl bg-[#125238] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f6b4f] transition disabled:opacity-50 cursor-pointer"
              >
                {actionLoadingId ? 'Đang gửi...' : 'Xác nhận gửi vé'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </main>;
}
