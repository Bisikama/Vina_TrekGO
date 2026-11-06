'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/features/auth';
import { Button, EmptyState, ErrorAlert, LoadingState, SurfaceCard } from '@/components/ui';
import { getBookingErrorMessage, getMyTripContext } from '../services/booking.api';
import { isTripRegistrationPaused, TripCancellationNotice } from './TripCancellationNotice';

export function UnavailableBookingTrip({ tripId, onReload }: { tripId: string; onReload: () => void }) {
  const { user, accessToken } = useAuth();
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    user?.id && accessToken ? ['my-unavailable-trip', user.id, tripId] : null,
    () => getMyTripContext(tripId, undefined, user?.id),
    { revalidateOnFocus: true, keepPreviousData: false, errorRetryCount: 0 },
  );
  const refresh = () => { void mutate(); onReload(); };
  if (isLoading) return <LoadingState message="Đang kiểm tra trạng thái chuyến đi của bạn..." />;
  return <SurfaceCard className="space-y-4">
    {data && isTripRegistrationPaused(data.trip.status) ? <>
      <h2 className="text-lg font-bold">{data.trip.title}</h2>
      <TripCancellationNotice status={data.trip.status} bookingStatus={data.bookingId ? data.bookingStatus : undefined} checking={isValidating} onRefresh={refresh} />
      {data.bookingId && <Link className="inline-block font-semibold text-[#125238] underline" href={`/bookings/${encodeURIComponent(data.bookingId)}`}>Xem đặt chỗ của tôi</Link>}
    </> : <EmptyState title="Chuyến hiện không khả dụng để đặt chỗ" description="Chuyến có thể đã ngừng nhận đăng ký hoặc không còn được công khai. Bạn có thể cập nhật lại trạng thái hoặc kiểm tra booking đã có." action={<Button variant="outline" onClick={refresh} loading={isValidating}>Cập nhật trạng thái</Button>} />}
    {error && <ErrorAlert message={getBookingErrorMessage(error).message} onRetry={refresh} />}
    <Link className="inline-block text-sm font-semibold text-[#125238] underline" href="/bookings">Đặt chỗ & vé của tôi</Link>
  </SurfaceCard>;
}
