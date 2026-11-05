'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/features/auth';
import { Button, EmptyState, ErrorAlert, LoadingState, PaginationBar, StatusBadge, SurfaceCard } from '@/components/ui';
import { bookingApiService, formatBookingDateTime, formatMoneyVND, getBookingErrorMessage } from '../services/booking.api';
import { REFUND_POLL_INTERVAL, REFUND_POLL_LIMIT, refundStatusLabel } from '../refund.utils';

function TransactionPage({ userId, page, setPage }: { userId: string; page: number; setPage: (page: number) => void }) {
  const reads = useRef(0);
  const { data, error, isLoading, isValidating, mutate } = useSWR(['booking-transactions', userId, page], () => bookingApiService.listBookingTransactions(page), {
    onSuccess: () => { reads.current++; },
    refreshInterval: (latest) => reads.current < REFUND_POLL_LIMIT && latest?.items.some((item) => ['PENDING', 'PROCESSING'].includes(item.status)) ? REFUND_POLL_INTERVAL : 0,
    errorRetryCount: 0,
  });
  return <SurfaceCard className="space-y-4" as="section">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Lịch sử giao dịch booking</h2><Button size="sm" variant="outline" loading={isValidating} onClick={() => { reads.current = 0; void mutate(); }}>Tải lại</Button></div>
    <p className="text-sm text-[#6B7280]">Khoản thu và khoản hoàn được ghi nhận riêng cho từng giao dịch.</p>
    {error && <ErrorAlert message={getBookingErrorMessage(error).message} onRetry={() => void mutate()} />}
    {isLoading && <LoadingState message="Đang tải lịch sử giao dịch booking..." />}
    {data && !error && !data.items.length && <EmptyState title="Chưa có giao dịch booking" />}
    {data && !error && data.items.map((item) => {
      const refund = item.kind === 'REFUND';
      const completed = item.status === 'SUCCEEDED';
      const label = refund ? refundStatusLabel(item.status) : ({ SUCCEEDED: 'Đã ghi nhận thu', PENDING: 'Chờ thanh toán', PROCESSING: 'Đang xử lý', FAILED: 'Thanh toán thất bại', CANCELLED: 'Đã hủy', EXPIRED: 'Hết hạn' } as Record<string, string>)[item.status] ?? item.status;
      return <article key={`${item.kind}:${item.id}`} className="space-y-2 rounded-xl border border-[#E5E7EB] p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong>{refund ? 'Khoản hoàn' : 'Khoản thu'}</strong><StatusBadge status={completed ? 'ACTIVE' : item.status === 'FAILED' ? 'CANCELLED' : 'PENDING'} customLabel={label} /></div>
        <p className="font-bold tabular-nums">{completed && item.financialEffect !== 'NONE' ? item.financialEffect === 'CREDIT' ? '+ ' : '− ' : ''}{formatMoneyVND(item.amount)}</p>
        <p>{item.description}</p>
        <p className="text-xs text-[#6B7280]">Tạo lúc: {formatBookingDateTime(item.createdAt)}{item.completedAt && ` · Ghi nhận: ${formatBookingDateTime(item.completedAt)}`}</p>
        <p className="break-all font-mono text-[11px] text-[#6B7280]">Mã giao dịch: {item.id}</p>
        {item.sourceId && <Link className="inline-block font-semibold text-[#2F6B4F] underline" href={`/bookings/${encodeURIComponent(item.sourceId)}`}>Xem đặt chỗ</Link>}
      </article>;
    })}
    {data && <PaginationBar page={data.pagination.page} pageSize={data.pagination.pageSize} total={data.pagination.total} onPageChange={setPage} itemLabel="giao dịch" disabled={isValidating} />}
  </SurfaceCard>;
}

export function BookingTransactions() {
  const { user, accessToken } = useAuth();
  const [page, setPage] = useState(1);
  if (!user?.id || !accessToken) return null;
  return <TransactionPage key={`${user.id}:${page}`} userId={user.id} page={page} setPage={setPage} />;
}
