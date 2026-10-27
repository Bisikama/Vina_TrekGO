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
import {
  PageShell,
  PageHeader,
  SurfaceCard,
  StatusBadge,
  Select,
  LoadingState,
  EmptyState,
  ErrorAlert,
  PaginationBar,
} from '@/components/ui';

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
      <PageShell maxWidth="md">
        <BookingSignIn />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="md">
      <PageHeader
        eyebrow="Vina TrekGO · Quản Lý Vé & Hành Trình"
        title="Đặt chỗ của tôi"
        subtitle="Quản lý danh sách các vé tham gia trekking, người đồng hành và trạng thái thanh toán."
        actions={
          <Link
            href="/trips"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#2F6B4F] px-4 text-sm font-semibold text-white shadow-xs transition hover:bg-[#1F4A36]"
          >
            Khám phá chuyến đi khác
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <label htmlFor="booking-status-filter" className="text-xs font-bold text-[#6B7280]">
            Lọc trạng thái:
          </label>
          <div className="w-52">
            <Select
              id="booking-status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(BOOKING_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {isLoading && !error && (
        <LoadingState message="Đang tải danh sách đặt chỗ của bạn..." />
      )}

      {!isLoading && bookings.length === 0 && !error && (
        <EmptyState
          icon="🎒"
          title="Chưa có đặt chỗ nào trong trạng thái này"
          description="Hãy khám phá các cung đường trekking sắp khởi hành và đặt chỗ cùng nhóm của bạn."
          action={
            <Link
              href="/trips"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2F6B4F] px-4 text-xs font-semibold text-white transition hover:bg-[#1F4A36]"
            >
              Xem lịch khởi hành
            </Link>
          }
        />
      )}

      <div className="space-y-4">
        {bookings.map((b) => (
          <SurfaceCard
            key={b.id}
            as="article"
            interactive
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="space-y-2">
              <StatusBadge
                status={b.status}
                customLabel={BOOKING_STATUS_LABELS[b.status] || b.status}
              />
              <h2 className="text-lg sm:text-xl font-bold text-[#1F2937]">
                {b.trip?.title}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B7280] tabular-nums">
                <span>📅 {formatBookingDateTime(b.trip?.startAt)}</span>
                <span>👥 {b.participantCount} thành viên</span>
                <span className="font-semibold text-[#1F2937]">
                  💰 Tổng tiền: {formatMoneyVND(b.totalAmount)}
                </span>
              </div>
            </div>

            <Link
              href={`/bookings/${b.id}`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[#125238] px-4 text-xs font-bold text-[#125238] transition hover:bg-[#2F6B4F]/10"
            >
              Xem chi tiết vé →
            </Link>
          </SurfaceCard>
        ))}
      </div>

      <PaginationBar
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />
    </PageShell>
  );
}
