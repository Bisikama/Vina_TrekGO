'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import { bookingApi, bookingError, money, dateTime } from '../booking.api';
import type { Page, Participant, PublicTrip } from '../booking.api';
import { BookingForm } from './BookingFlow/BookingForm';
import { BookingSignIn } from './BookingSignIn';

export function PublicBookingTrips() {
  const [data, setData] = useState<Page<PublicTrip> | null>(null); const [error, setError] = useState('');
  const [page, setPage] = useState(1); const [filters, setFilters] = useState<Record<string, string>>({});
  useEffect(() => { let active = true; bookingApi.trips({ ...filters, page }).then((v) => { if (active) { setData(v); setError(''); } }).catch((e) => { if (active) setError(bookingError(e).message); }); return () => { active = false; }; }, [page, filters]);
  return <div className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28"><div className="mx-auto max-w-6xl space-y-7">
    <div className="flex flex-wrap justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-green-800">TrekGo · Public Trips</p><h1 className="mt-2 text-4xl font-bold">Chọn hành trình tiếp theo</h1><p className="mt-3 text-stone-600">Xem lịch khởi hành, chỗ trống và đặt chỗ cùng nhóm của bạn.</p></div><Link href="/bookings" className="h-fit rounded-lg border border-green-900 px-4 py-2 text-green-900">Đặt chỗ của tôi</Link></div>
    <form className="grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); const values = new FormData(e.currentTarget); setPage(1); setFilters(Object.fromEntries([...values.entries()].filter(([, v]) => String(v)).map(([k, v]) => [k, String(v)]))); }}>
      <label className="text-sm">Từ ngày<input type="date" name="dateFrom" className="mt-1 w-full rounded border p-2" /></label><label className="text-sm">Đến ngày<input type="date" name="dateTo" className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm">Độ khó<select name="difficulty" className="mt-1 w-full rounded border p-2"><option value="">Tất cả</option><option value="EASY">Dễ</option><option value="MEDIUM">Trung bình</option><option value="HARD">Khó</option><option value="EXTREME">Rất khó</option></select></label>
      <label className="text-sm">Giá tối đa (₫)<input type="number" min="0" name="price" className="mt-1 w-full rounded border p-2" /></label><button className="self-end rounded bg-green-900 p-2 text-white">Tìm chuyến đi</button>
    </form>
    {error && <p role="alert" className="rounded bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={() => setFilters({ ...filters })}>Thử lại</button></p>}
    {!data && !error && <p role="status">Đang tải chuyến đi…</p>}
    {data?.items.length === 0 && <p className="rounded-xl bg-white p-8">Chưa có chuyến đi phù hợp. Hãy thay đổi bộ lọc hoặc quay lại sau.</p>}
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data?.items.map((trip) => <article key={trip.id} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-green-800">{trip.destination.name} · {trip.remainingSlots} chỗ trống</p><h2 className="mt-3 text-xl font-bold"><Link href={`/trips/${trip.id}`}>{trip.title}</Link></h2>
      <p className="mt-4 text-sm">{dateTime(trip.startAt)}</p><p className="mt-2 text-sm text-stone-600">Leader: {trip.leader?.fullName ?? 'Đang cập nhật'}</p><p className="mt-4 font-semibold">{trip.pricePerPax ? money(trip.pricePerPax) : 'Chưa có giá'} / người</p>
      <Link href={`/trips/${trip.id}`} className="mt-5 rounded-lg bg-green-900 p-3 text-center text-white">Xem chuyến đi</Link>
    </article>)}</div>
    {data && <div className="flex items-center justify-center gap-4"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded border px-4 py-2 disabled:opacity-40">Trước</button><span>Trang {data.page} · {data.total} chuyến</span><button disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} className="rounded border px-4 py-2 disabled:opacity-40">Sau</button></div>}
  </div></div>;
}

export function PublicBookingTrip({ tripId }: { tripId: string }) {
  const { accessToken, user } = useAuth(); const router = useRouter();
  const [trip, setTrip] = useState<PublicTrip | null>(null); const [error, setError] = useState('');
  const [existingId, setExistingId] = useState<string>(); const [busy, setBusy] = useState(false);
  const attempt = useRef({ hash: '', key: '' }); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; bookingApi.trip(tripId).then((v) => { if (active) { setTrip(v); setError(''); } }).catch((e) => { if (active) setError(bookingError(e).message); }); return () => { active = false; }; }, [tripId, retry]);
  const create = async (people: Participant[]) => {
    setBusy(true); setError('');
    try {
      const hash = JSON.stringify(people);
      if (hash !== attempt.current.hash) attempt.current = { hash, key: crypto.randomUUID() };
      const result = await bookingApi.create(tripId, people, attempt.current.key);
      router.push(`/bookings/${result.id}`);
    } catch (e) { const failure = bookingError(e); setError(failure.message); setExistingId(failure.bookingId); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28"><div className="mx-auto max-w-5xl space-y-6"><Link href="/trips" className="text-green-900 underline">← Các chuyến đi</Link>
    {error && <p role="alert" className="rounded bg-red-50 p-4 text-red-800">{error} {existingId ? <Link className="underline" href={`/bookings/${existingId}`}>Mở đặt chỗ hiện có</Link> : <button className="underline" onClick={() => setRetry(retry + 1)}>Tải lại</button>}</p>}
    {!trip && !error && <p role="status">Đang tải chuyến đi…</p>}
    {trip && <><header><p className="text-green-800">{trip.destination.name}</p><h1 className="mt-2 text-4xl font-bold">{trip.title}</h1><p className="mt-4 max-w-3xl whitespace-pre-line text-stone-700">{trip.description}</p></header>
      <div className="grid items-start gap-6 lg:grid-cols-2"><section className="space-y-5 rounded-2xl bg-white p-6">
        <h2 className="text-xl font-semibold">Thông tin hành trình</h2><p>{dateTime(trip.startAt)} – {dateTime(trip.endAt)}</p><p>Leader: {trip.leader?.fullName ?? 'Đang cập nhật'}</p><p>Tập kết: {trip.pickup ? `${trip.pickup.name} · ${trip.pickup.address}` : 'Đang cập nhật'}</p>
        <div><h3 className="font-semibold">Tuyến đường</h3><ul className="mt-2 space-y-2">{trip.routes.map((r) => <li key={r.id}>{r.snapshotName} · {r.snapshotDifficulty} {r.snapshotDistanceKm && `· ${r.snapshotDistanceKm} km`}</li>)}</ul></div>
        <div><h3 className="font-semibold">Checkpoint</h3><ol className="mt-2 list-inside list-decimal space-y-1">{trip.checkpoints.map((c) => <li key={c.id}>{c.name}{c.isRequired ? ' (bắt buộc)' : ''}</li>)}</ol></div>
        <p>Phương tiện: {trip.transport.map((t) => t.vehicleType).join(', ') || 'Chưa được bố trí'}</p><p className="text-sm text-stone-500">Biển số và liên hệ tài xế được cung cấp sau khi đặt chỗ được xác nhận.</p>
      </section><section className="space-y-5 rounded-2xl bg-white p-6"><div className="flex flex-wrap justify-between gap-3"><strong className="text-2xl text-green-900">{trip.pricePerPax ? money(trip.pricePerPax) : 'Chưa có giá'} / người</strong><span>Còn {trip.remainingSlots}/{trip.capacity} chỗ</span></div>
        {accessToken ? trip.status === 'OPEN' && trip.remainingSlots > 0 ? <BookingForm initial={[{ fullName: user?.fullName ?? '' }]} max={trip.remainingSlots} busy={busy} submitLabel="Giữ chỗ và xem tổng tiền" onSubmit={create} /> : <p>Chuyến đi hiện không còn nhận đặt chỗ.</p> : <BookingSignIn />}
        <p className="text-sm text-stone-500">Số chỗ được kiểm tra lại khi gửi yêu cầu. Tổng tiền và hạn giữ chỗ sẽ được hiển thị trước khi thanh toán.</p>
      </section></div></>}
  </div></div>;
}
