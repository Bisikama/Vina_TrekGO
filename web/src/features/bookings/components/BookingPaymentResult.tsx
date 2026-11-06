'use client';

import Link from 'next/link';
import { Button, ErrorAlert, InfoBanner, LoadingState, PageHeader, PageShell, StatusBadge, SurfaceCard } from '@/components/ui';
import { money } from '../booking.api';
import { bookingPaymentState } from '../refund.utils';
import type { Booking } from '../booking.api';
import { BookingRefunds } from './BookingRefunds';

export function BookingPaymentResult({ bookingId, booking, checking, error, onReload }: {
  bookingId: string | null; booking: Booking | null; checking: boolean; error: string; onReload: () => void;
}) {
  const state = bookingPaymentState(booking);
  const messages = {
    VERIFYING: ['Đang xác minh thanh toán', 'Hệ thống đang kiểm tra kết quả thanh toán và xác nhận đặt chỗ. Nếu đã thanh toán, hãy chờ cập nhật và tránh thanh toán thêm.'],
    CONFIRMED: ['Đặt chỗ đã được xác nhận', 'Thanh toán đã được hệ thống ghi nhận và áp dụng thành công. Vé của bạn đã sẵn sàng.'],
    CANCELLED: ['Đặt chỗ đã hủy', 'Bạn có thể theo dõi các khoản hoàn liên quan bên dưới.'],
    REJECTED: ['Đã ghi nhận khoản thu, không áp dụng được vào đặt chỗ', 'Hệ thống đang theo dõi khoản hoàn giao dịch kỹ thuật bên dưới.'],
    FAILED: ['Thanh toán chưa thành công', 'Hệ thống ghi nhận giao dịch bị hủy, hết hạn hoặc thất bại. Mở đặt chỗ để kiểm tra trước khi thử lại.'],
  };
  const [title, message] = messages[state];
  return <PageShell maxWidth="sm">
    <PageHeader title="Kết quả thanh toán đặt chỗ" />
    {!bookingId ? <SurfaceCard className="space-y-4"><InfoBanner title="Chưa xác định được giao dịch">Không khôi phục được đặt chỗ của phiên thanh toán. Hãy mở danh sách đặt chỗ để kiểm tra.</InfoBanner><Link href="/bookings" className="font-semibold text-[#2F6B4F] underline">Đặt chỗ của tôi</Link></SurfaceCard> : <div className="space-y-4">
      <SurfaceCard className="space-y-4" aria-live="polite">
        <InfoBanner tone={state === 'CONFIRMED' ? 'success' : state === 'VERIFYING' ? 'info' : 'warning'} title={title}>{message}</InfoBanner>
        {checking && !booking && !error && <LoadingState message="Đang đọc trạng thái thanh toán..." className="p-4" />}
        {checking && booking && <p className="text-sm text-[#6B7280]">Đang tự động cập nhật trạng thái đặt chỗ.</p>}
        {!checking && state === 'VERIFYING' && <InfoBanner tone="warning">Chưa nhận được xác nhận cuối cùng. Bạn có thể tải lại hoặc mở chi tiết đặt chỗ để tiếp tục kiểm tra.</InfoBanner>}
        {error && <ErrorAlert message={error} onRetry={onReload} />}
        {booking && <div className="space-y-2 text-sm"><p className="font-semibold">{booking.trip.title}</p><StatusBadge status={booking.status} /><p>Tổng tiền đặt chỗ: <strong className="tabular-nums">{money(booking.totalAmount)}</strong></p></div>}
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-[#2F6B4F]"><Button variant="outline" size="sm" onClick={onReload}>Tải lại</Button><Link href={`/bookings/${encodeURIComponent(bookingId)}`}>Xem đặt chỗ</Link><Link href="/bookings">Đặt chỗ của tôi</Link></div>
      </SurfaceCard>
      {booking && <BookingRefunds key={bookingId} bookingId={bookingId} booking={booking} />}
    </div>}
  </PageShell>;
}
