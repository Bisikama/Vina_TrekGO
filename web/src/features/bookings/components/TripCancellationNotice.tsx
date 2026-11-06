'use client';

import useSWR from 'swr';
import { useRef } from 'react';
import { useAuth } from '@/features/auth';
import { Button, ErrorAlert, InfoBanner } from '@/components/ui';
import { bookingApi, bookingError } from '../booking.api';
import { REFUND_POLL_INTERVAL, REFUND_POLL_LIMIT } from '../refund.utils';

export const isTripRegistrationPaused = (status?: string | null) => status === 'CANCEL_PENDING' || status === 'CANCELLED';
export const needsTripCancellationRefresh = (booking?: { status: string; trip: { status: string } } | null) => !!booking && isTripRegistrationPaused(booking.trip.status) && ['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status);

export function TripCancellationNotice({ status, bookingStatus, onRefresh, checking = false, compact = false }: {
  status?: string | null;
  bookingStatus?: string | null;
  onRefresh?: () => void;
  checking?: boolean;
  compact?: boolean;
}) {
  if (!isTripRegistrationPaused(status)) return null;
  const pending = status === 'CANCEL_PENDING';
  const activeBooking = !!bookingStatus && !['CANCELLED', 'EXPIRED'].includes(bookingStatus);
  if (compact) return <InfoBanner tone="warning" title={pending ? 'Đang chờ duyệt hủy chuyến' : 'Chuyến đi đã hủy'} className="[&]:p-3 [&_p]:text-xs [&_div]:text-xs">
    {pending ? 'Chuyến tạm ngừng nhận đăng ký. Theo dõi chi tiết để cập nhật kết quả.' : 'Xem chi tiết chuyến hoặc đặt chỗ để theo dõi thông tin liên quan.'}
  </InfoBanner>;
  return <InfoBanner tone="warning" title={pending ? 'Chuyến đang chờ duyệt hủy — tạm ngừng đăng ký' : 'Chuyến đi đã bị hủy'}>
    <div className="space-y-2">
      <p>{pending ? 'Leader đã gửi yêu cầu hủy chuyến và đang chờ Admin xét duyệt. Chuyến tạm ngừng nhận đặt chỗ mới.' : 'Chuyến không còn nhận đặt chỗ. Xem chi tiết booking để theo dõi khoản hoàn liên quan.'}</p>
      {activeBooking && <p>{pending ? 'Booking của bạn chưa bị hủy. Nếu bạn tự hủy lúc này, mức hoàn được tính theo chính sách hiện hành và không được hoàn bổ sung nếu chuyến được duyệt hủy sau đó.' : 'Hệ thống đang cập nhật trạng thái booking và xử lý các khoản hoàn liên quan.'}</p>}
      {onRefresh && <Button variant="outline" size="sm" loading={checking} onClick={onRefresh}>Cập nhật trạng thái</Button>}
    </div>
  </InfoBanner>;
}

export function BookingTripCancellationNotice({ bookingId, bookingStatus, onBookingChanged }: {
  bookingId: string;
  bookingStatus: string;
  onBookingChanged: () => void;
}) {
  const { user, accessToken } = useAuth();
  const reads = useRef(0);
  const { data, error, isValidating, mutate } = useSWR(
    user?.id && accessToken ? ['booking-trip-state', user.id, bookingId] : null,
    () => bookingApi.detail(bookingId),
    { revalidateOnFocus: true, keepPreviousData: false, errorRetryCount: 0,
      refreshInterval: (latest) => needsTripCancellationRefresh(latest) && reads.current < REFUND_POLL_LIMIT ? REFUND_POLL_INTERVAL : 0,
      onSuccess: (next) => { reads.current = needsTripCancellationRefresh(next) ? reads.current + 1 : 0; if (next.status !== bookingStatus) onBookingChanged(); } },
  );
  const refresh = () => { reads.current = 0; void mutate(); onBookingChanged(); };
  return <>
    <TripCancellationNotice status={data?.trip.status} bookingStatus={data?.status ?? bookingStatus} checking={isValidating} onRefresh={refresh} />
    {error && <ErrorAlert message={bookingError(error).message} onRetry={refresh} />}
  </>;
}
