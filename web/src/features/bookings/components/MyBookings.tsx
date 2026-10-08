'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { bookingApi, bookingError, dateTime, money, statusLabels } from '../booking.api';
import type { BookingSummary, Page } from '../booking.api';
import { BookingSignIn } from './BookingSignIn';

export function MyBookings() {
  const { accessToken } = useAuth(); const [data, setData] = useState<Page<BookingSummary> | null>(null);
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { if (!accessToken) return; let active = true; bookingApi.list(page, status).then((v) => { if (active) { setData(v); setError(''); } }).catch((e) => { if (active) setError(bookingError(e).message); }); return () => { active = false; }; }, [accessToken, page, status, retry]);
  return <div className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28"><div className="mx-auto max-w-4xl space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold">Đặt chỗ của tôi</h1><Link href="/trips" className="text-green-900 underline">Khám phá chuyến đi</Link></div>
    {!accessToken ? <BookingSignIn /> : <>
      <label>Trạng thái <select className="ml-3 rounded border bg-white p-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      {error && <p role="alert" className="text-red-800">{error} <button className="underline" onClick={() => setRetry(retry + 1)}>Thử lại</button></p>}
      {!data && !error && <p role="status">Đang tải…</p>}{data?.items.length === 0 && <p className="rounded-xl bg-white p-8">Chưa có đặt chỗ trong trạng thái này.</p>}
      {data?.items.map((b) => <article key={b.id} className="flex flex-wrap justify-between gap-4 rounded-xl bg-white p-6 shadow-sm"><div><p className="text-sm font-semibold text-green-800">{statusLabels[b.status]}</p><h2 className="mt-2 text-xl font-semibold">{b.trip.title}</h2><p className="mt-2 text-sm">{dateTime(b.trip.startAt)} · {b.participantCount} người · {money(b.totalAmount)}</p></div><Link href={`/bookings/${b.id}`} className="h-fit rounded-lg border border-green-900 px-4 py-2 text-green-900">Xem đặt chỗ</Link></article>)}
      {data && <div className="flex items-center justify-center gap-4"><button disabled={page === 1} className="rounded border p-2 disabled:opacity-40" onClick={() => setPage(page - 1)}>Trước</button><span>Trang {data.page}</span><button disabled={page * data.pageSize >= data.total} className="rounded border p-2 disabled:opacity-40" onClick={() => setPage(page + 1)}>Sau</button></div>}
    </>}
  </div></div>;
}
