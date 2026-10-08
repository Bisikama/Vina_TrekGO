'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { bookingApi, bookingError, dateTime, money, statusLabels } from '../../booking.api';
import type { Booking, Checkout, Participant } from '../../booking.api';
import { BookingForm } from './BookingForm';
import { BookingSignIn } from '../BookingSignIn';

function safeCheckoutUrl(checkout: Checkout | null | undefined) {
  if (!checkout?.url) return null;
  try { const url = new URL(checkout.url); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
export const BookingLayout = ({ bookingId }: { bookingId: string }) => {
  const { accessToken } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false); const [now, setNow] = useState(0); const [reason, setReason] = useState('');
  const [dirty, setDirty] = useState(false);
  const payKey = useRef(''); const cancelKey = useRef('');
  const load = useCallback(async () => { const result = await bookingApi.detail(bookingId); setBooking(result); return result; }, [bookingId]);
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    const refresh = () => bookingApi.detail(bookingId).then((data) => { if (active) setBooking((current) => current && current.version > data.version ? current : data); }).catch((e) => { if (active) setError(bookingError(e).message); });
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [accessToken, bookingId]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const action = async (run: () => Promise<void>) => { setBusy(true); setError(''); setNotice(''); try { await run(); } catch (e) { setError(bookingError(e).message); } finally { setBusy(false); } };
  const update = (people: Participant[]) => action(async () => { if (booking) { setBooking(await bookingApi.update(booking, people)); setDirty(false); setNotice('Đã cập nhật thành viên và tổng tiền.'); } });
  const pay = () => action(async () => {
    const storageKey = `cf02:payment:${bookingId}`;
    const terminal = booking?.paymentSummary && ['FAILED', 'CANCELLED', 'EXPIRED'].includes(booking.paymentSummary.status);
    if (!payKey.current) payKey.current = (!terminal && sessionStorage.getItem(storageKey)) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, payKey.current);
    const result = await bookingApi.pay(bookingId, payKey.current);
    await load();
    const url = safeCheckoutUrl(result.checkout);
    if (url && result.providerEnvironment !== 'MOCK') window.location.assign(url);
    else setNotice(result.providerEnvironment === 'MOCK' ? 'Đây là môi trường thanh toán thử nghiệm. Đặt chỗ sẽ được xác nhận khi hệ thống nhận kết quả thanh toán hợp lệ.' : 'Đã gửi yêu cầu thanh toán. Đang chờ cổng thanh toán trả kết quả.');
  });
  const seconds = booking && now ? Math.max(0, Math.ceil((Date.parse(booking.expiresAt) - now) / 1000)) : null;
  const waiting = booking?.status === 'PENDING_PAYMENT';
  const paymentOpen = booking?.paymentSummary && ['PENDING', 'PROCESSING', 'SUCCEEDED'].includes(booking.paymentSummary.status);
  const checkoutUrl = booking?.paymentSummary?.providerEnvironment === 'MOCK' ? null : safeCheckoutUrl(booking?.paymentSummary?.checkout);
  return <div className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28"><div className="mx-auto max-w-5xl space-y-6">
    <Link className="text-green-900 underline" href="/bookings">← Đặt chỗ của tôi</Link><h1 className="text-3xl font-bold">Chi tiết đặt chỗ</h1>
    {!accessToken ? <BookingSignIn /> : <>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={() => void action(async () => { await load(); })}>Tải lại</button></p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-4">{notice}</p>}
      {!booking && !error && <p role="status">Đang tải đặt chỗ…</p>}
      {booking && <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
          <div><p className="text-sm font-semibold text-green-800">{statusLabels[booking.status] ?? booking.status}</p><h2 className="mt-2 text-2xl font-bold">{booking.trip.title}</h2><p className="mt-2">{dateTime(booking.trip.startAt)} – {dateTime(booking.trip.endAt)}</p><p className="mt-2">Tập kết: {booking.pickup.name} · {booking.pickup.address}</p></div>
          {waiting && <p role="timer" className="rounded-lg bg-amber-50 p-4">{seconds === 0 ? 'Đã hết thời gian giữ chỗ. Đang cập nhật trạng thái…' : `Giữ chỗ đến ${dateTime(booking.expiresAt)}${seconds === null ? '' : ` · còn ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}`}</p>}
          {booking.canEditParticipants && seconds !== 0 ? <BookingForm key={booking.version} initial={booking.participants} onDirtyChange={setDirty} max={100} busy={busy} submitLabel="Lưu thay đổi thành viên" onSubmit={update} /> : <div><h3 className="font-semibold">Thành viên</h3><ul className="mt-2 space-y-2">{booking.participants.map((p, i) => <li key={p.id}>{i + 1}. {p.fullName}</li>)}</ul>{waiting && <p className="mt-3 text-sm text-stone-600">Không thể sửa thành viên trong khi giao dịch đang được xử lý.</p>}</div>}
          <div><h3 className="font-semibold">Phương tiện</h3>{booking.transport.length ? booking.transport.map((t, i) => <p key={i} className="mt-2">{t.vehicleType}{t.plateNumber && ` · ${t.plateNumber}`}{t.driverName && ` · ${t.driverName}`}{t.driverPhone && ` · ${t.driverPhone}`}</p>) : <p className="mt-2 text-stone-600">Chưa có thông tin phương tiện.</p>}{waiting && <p className="mt-2 text-sm text-stone-500">Thông tin tài xế và biển số hiển thị sau khi xác nhận đặt chỗ.</p>}</div>
          {booking.status === 'EXPIRED' && <Link className="inline-block rounded-lg bg-green-900 p-3 text-white" href={`/trips/${booking.trip.id}`}>Xem chuyến đi và đặt lại</Link>}
        </section>
        <aside className="h-fit space-y-4 rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Thanh toán</h2><p>{money(booking.pricePerPax)} × {booking.participantCount} người</p><p className="border-t pt-4 text-2xl font-bold text-green-900">{money(booking.totalAmount)}</p>
          {booking.status === 'CONFIRMED' && <p role="status" className="rounded-lg bg-green-50 p-3">Đặt chỗ đã được xác nhận.</p>}
          {dirty && waiting && <p className="text-sm text-amber-800">Lưu thay đổi thành viên trước khi thanh toán.</p>}{waiting && seconds !== 0 && <>
            {paymentOpen ? <p>Đang chờ kết quả thanh toán. Trang sẽ tự cập nhật.</p> : <button disabled={busy || dirty} onClick={() => { payKey.current = ''; void pay(); }} className="w-full rounded-lg bg-green-900 p-3 font-semibold text-white disabled:opacity-50">{busy ? 'Đang xử lý…' : booking.paymentSummary ? 'Thử thanh toán lại' : 'Thanh toán'}</button>}
            {checkoutUrl && <a href={checkoutUrl} className="block rounded-lg border p-3 text-center text-green-900">Mở cổng thanh toán</a>}
            {booking.paymentSummary?.providerEnvironment === 'MOCK' && <p className="text-sm text-amber-800">Môi trường thử nghiệm, không thu tiền thật.</p>}
          </>}
          {booking.paymentSummary?.reconciliationRequired && <p className="text-sm text-amber-800">Hệ thống đang đối soát giao dịch. Không thanh toán thêm khi chưa rõ kết quả.</p>}
          {booking.paymentSummary?.applicationStatus === 'REJECTED' && <p className="text-sm text-amber-800">Khoản thanh toán không được áp dụng cho đặt chỗ. Hệ thống đang xử lý hoàn giao dịch; bạn có thể theo dõi bên dưới.</p>}
          {booking.refunds.map((r) => <p key={r.refundId} className="text-sm">Hoàn {money(r.amount)} · {r.status}</p>)}
          {booking.rentalEligible && <p className="rounded-lg bg-green-50 p-3 text-sm">Đặt chỗ đủ điều kiện thuê thiết bị.</p>}
          {booking.status === 'CONFIRMED' && !booking.canCancel && <p className="text-sm text-stone-600">Đặt chỗ hiện không hỗ trợ tự hủy sau thanh toán. Vui lòng liên hệ hỗ trợ nếu cần.</p>}
          {booking.canCancel && <form className="space-y-3 border-t pt-4" onSubmit={(e) => { e.preventDefault(); void action(async () => { cancelKey.current ||= crypto.randomUUID(); await bookingApi.cancel(bookingId, reason, cancelKey.current); await load(); setNotice('Đã hủy đặt chỗ. Hoàn tiền (nếu có) được xử lý theo chính sách đã lưu.'); }); }}>
            <label className="block text-sm">Lý do hủy<textarea required maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); cancelKey.current = ''; }} className="mt-1 w-full rounded-lg border p-2" /></label>
            <p className="text-xs text-stone-500">Hủy sẽ giải phóng chỗ. Số tiền hoàn phụ thuộc chính sách của đặt chỗ.</p><button disabled={busy} className="text-red-700 underline disabled:opacity-50">Hủy đặt chỗ</button>
          </form>}
        </aside>
      </div>}
    </>}
  </div></div>;
};
