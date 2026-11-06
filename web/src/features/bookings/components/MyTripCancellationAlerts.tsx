'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/features/auth';
import { Button, ErrorAlert, StatusBadge, SurfaceCard, SurfaceSectionHeader } from '@/components/ui';
import { formatBookingDateTime, getBookingErrorMessage, listMyTripCancellationContexts } from '../services/booking.api';
import { TripCancellationNotice } from './TripCancellationNotice';

export function useMyTripCancellationAlerts() {
  const { user, accessToken } = useAuth();
  const state = useSWR(
    user?.id && accessToken ? ['my-trip-cancellation-alerts', user.id] : null,
    () => listMyTripCancellationContexts(undefined, user?.id),
    { revalidateOnFocus: true, keepPreviousData: false, errorRetryCount: 0,
      refreshInterval: (latest) => latest?.some((item) => item.trip.status === 'CANCEL_PENDING') ? 30_000 : 0 },
  );
  return { ...state, enabled: !!user?.id && !!accessToken };
}

export function MyTripCancellationAlerts({ state }: { state: ReturnType<typeof useMyTripCancellationAlerts> }) {
  const { data, error, isLoading, isValidating, mutate, enabled } = state;
  if (!enabled) return null;
  if (isLoading) return <p role="status" className="text-sm text-[#6B7280]">Đang kiểm tra các chuyến bạn đã đặt...</p>;
  if (!data?.length && !error) return null;
  return <section aria-label="Chuyến của bạn cần lưu ý" className="space-y-4">
    <SurfaceSectionHeader title="Chuyến của bạn cần lưu ý" subtitle="Các chuyến sắp tới bạn đã đặt chỗ hoặc có vé đang chờ duyệt hủy hoặc đã bị hủy." action={<Button variant="outline" size="sm" loading={isValidating} onClick={() => void mutate()}>Cập nhật trạng thái</Button>} />
    {error && <ErrorAlert message={getBookingErrorMessage(error).message} onRetry={() => void mutate()} />}
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {data?.map((context) => {
        const pending = context.trip.status === 'CANCEL_PENDING';
        const href = context.bookingId ? `/bookings/${encodeURIComponent(context.bookingId)}` : `/trips/${encodeURIComponent(context.trip.id)}`;
        return <SurfaceCard key={context.trip.id} as="article" className="flex flex-col gap-4">
          <StatusBadge status={pending ? 'PENDING' : 'CANCELLED'} customLabel={pending ? 'Chờ duyệt hủy' : 'Đã hủy chuyến'} className="self-start" />
          <h3 className="text-lg font-bold"><Link href={href} className="hover:text-[#125238]">{context.trip.title}</Link></h3>
          <p className="text-xs text-[#6B7280] tabular-nums">Khởi hành: {formatBookingDateTime(context.trip.startAt)}</p>
          <TripCancellationNotice status={context.trip.status} bookingStatus={context.bookingId ? context.bookingStatus : undefined} />
          <Link href={href} className="mt-auto inline-flex h-9 items-center justify-center rounded-lg border border-[#125238] px-3 text-xs font-semibold text-[#125238] hover:bg-[#2F6B4F]/10">{context.bookingId ? 'Xem đặt chỗ & khoản hoàn' : 'Xem trạng thái chuyến'}</Link>
        </SurfaceCard>;
      })}
    </div>
  </section>;
}
