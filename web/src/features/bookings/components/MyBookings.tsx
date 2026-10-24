'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth';
import { useMyBookings } from '../hooks';
import {
  BOOKING_STATUS_LABELS,
  formatBookingDateTime,
  formatMoneyVND,
} from '../services/booking.api';
import { BookingSignIn } from './BookingSignIn';

export function MyBookings() {
  const { accessToken } = useAuth();
  const {
    bookings,
    total,
    page,
    pageSize,
    isLoading,
    error,
    status,
    setStatus,
    setPage,
    refetch,
  } = useMyBookings();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('vnp_ResponseCode') || url.searchParams.has('resultCode')) {
        window.location.replace(`/payment-return?${url.searchParams.toString()}`);
      }
    }
  }, []);

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28">
        <div className="mx-auto max-w-4xl space-y-6">
          <BookingSignIn />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F4] px-4 pb-20 pt-28">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-stone-900">Đặt chỗ của tôi</h1>
            <p className="mt-1 text-sm text-stone-500">
              Quản lý danh sách các vé tham gia trekking và thông tin thanh toán.
            </p>
          </div>
          <Link
            href="/trips"
            className="rounded-xl bg-[#125238] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#2f6b4f]"
          >
            Khám phá chuyến đi khác
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-stone-600">
            Lọc trạng thái:
            <select
              className="ml-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 shadow-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(BOOKING_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <span>{error}</span>
            <button type="button" className="underline font-bold" onClick={refetch}>
              Thử lại
            </button>
          </div>
        )}

        {isLoading && !error && (
          <p className="p-8 text-center text-sm text-stone-500">Đang tải danh sách đặt chỗ…</p>
        )}

        {!isLoading && bookings.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-12 text-center text-stone-500">
            Chưa có đặt chỗ nào trong trạng thái này.
          </div>
        )}

        <div className="space-y-4">
          {bookings.map((b) => (
            <article
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="space-y-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    b.status === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : b.status === 'PENDING_PAYMENT'
                      ? 'bg-amber-100 text-amber-800'
                      : b.status === 'CANCELLED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-stone-100 text-stone-800'
                  }`}
                >
                  {BOOKING_STATUS_LABELS[b.status] || b.status}
                </span>
                <h2 className="text-xl font-bold text-stone-900">{b.trip?.title}</h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
                  <span>📅 {formatBookingDateTime(b.trip?.startAt)}</span>
                  <span>👥 {b.participantCount} thành viên</span>
                  <span>💰 Tổng tiền: {formatMoneyVND(b.totalAmount)}</span>
                </div>
              </div>

              <Link
                href={`/bookings/${b.id}`}
                className="rounded-xl border border-[#125238] px-4 py-2 text-xs font-bold text-[#125238] transition hover:bg-emerald-50"
              >
                Xem chi tiết vé →
              </Link>
            </article>
          ))}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              type="button"
              disabled={page === 1}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 disabled:opacity-40"
              onClick={() => setPage(page - 1)}
            >
              ← Trước
            </button>
            <span className="text-xs font-semibold text-stone-600">
              Trang {page} / {Math.ceil(total / pageSize)}
            </span>
            <button
              type="button"
              disabled={page * pageSize >= total}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 disabled:opacity-40"
              onClick={() => setPage(page + 1)}
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
