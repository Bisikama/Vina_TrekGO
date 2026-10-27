'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth';
import {
  usePublicBookingTrips,
  usePublicBookingTripDetail,
  useBookingMutations,
} from '../hooks';
import { formatBookingDateTime, formatMoneyVND } from '../services/booking.api';
import type { Participant, PublicTrip } from '../types/booking.types';
import { BookingSignIn } from './BookingSignIn';
import {
  PageShell,
  PageHeader,
  SurfaceCard,
  SurfaceSectionHeader,
  Button,
  FormField,
  Input,
  Select,
  StatusBadge,
  LoadingState,
  EmptyState,
  ErrorAlert,
  InfoBanner,
  PaginationBar,
  TripSummaryBanner,
} from '@/components/ui';

export function PublicBookingTrips() {
  const {
    trips,
    total,
    page,
    pageSize,
    isLoading,
    error,
    setPage,
    setFilters,
    refetch,
  } = usePublicBookingTrips();

  const handleFilterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const filterObj: Record<string, any> = {};

    const dateFrom = values.get('dateFrom')?.toString();
    const dateTo = values.get('dateTo')?.toString();
    const difficulty = values.get('difficulty')?.toString();
    const priceMax = values.get('price')?.toString();

    if (dateFrom) filterObj.dateFrom = dateFrom;
    if (dateTo) filterObj.dateTo = dateTo;
    if (difficulty) filterObj.difficulty = difficulty;
    if (priceMax) filterObj.priceMax = Number(priceMax);

    setFilters(filterObj);
  };

  return (
    <PageShell>
      <div className="space-y-7">
        <PageHeader
          eyebrow="Vina TrekGO · Khám Phá Chuyến Đi"
          title="Chọn hành trình tiếp theo"
          description="Xem lịch khởi hành, chỗ trống thực tế và đặt chỗ cùng nhóm của bạn."
          actions={
            <Link
              href="/bookings"
              className="inline-flex h-11 items-center rounded-xl border border-[#2F6B4F] bg-white px-4 text-sm font-bold text-[#125238] transition hover:bg-emerald-50"
            >
              Đặt chỗ của tôi
            </Link>
          }
        />

        <SurfaceCard padding="md">
          <form
            className="grid gap-4 sm:grid-cols-5 items-end"
            onSubmit={handleFilterSubmit}
          >
            <FormField label="Từ ngày">
              <Input type="date" name="dateFrom" />
            </FormField>
            <FormField label="Đến ngày">
              <Input type="date" name="dateTo" />
            </FormField>
            <FormField label="Độ khó">
              <Select name="difficulty" defaultValue="">
                <option value="">Tất cả</option>
                <option value="EASY">Dễ</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HARD">Khó</option>
                <option value="EXTREME">Rất khó</option>
              </Select>
            </FormField>
            <FormField label="Giá tối đa (₫)">
              <Input
                type="number"
                min="0"
                name="price"
                placeholder="VD: 3000000"
              />
            </FormField>
            <Button type="submit" fullWidth>
              Tìm chuyến đi
            </Button>
          </form>
        </SurfaceCard>

        {error && <ErrorAlert message={error} onRetry={refetch} />}

        {isLoading && !error && (
          <LoadingState label="Đang tải danh sách chuyến đi công khai…" />
        )}

        {!isLoading && trips.length === 0 && !error && (
          <EmptyState
            title="Chưa có chuyến đi phù hợp"
            description="Hãy thay đổi bộ lọc tìm kiếm hoặc quay lại kiểm tra sau."
          />
        )}

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip: PublicTrip) => {
            const nowMs = Date.now();
            const openAtMs = trip.registrationOpenAt
              ? new Date(trip.registrationOpenAt).getTime()
              : null;
            const isNotOpenYet =
              openAtMs !== null && Number.isFinite(openAtMs) && nowMs < openAtMs;
            const displayStatus =
              trip.status === 'OPEN' && isNotOpenYet ? 'NOT_OPEN_YET' : trip.status;

            return (
              <SurfaceCard
                key={trip.id}
                interactive
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      title={`${trip.destination?.name ?? ''} · Còn ${trip.remainingSlots} chỗ`}
                      className="inline-flex min-w-0 items-center whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#125238] tabular-nums"
                    >
                      <span className="truncate">{trip.destination?.name}</span>
                      <span className="shrink-0">&nbsp;· Còn {trip.remainingSlots} chỗ</span>
                    </span>
                    <StatusBadge
                      status={displayStatus}
                      className="px-2.5 py-0.5 text-[11px]"
                    />
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-[#1F2937] line-clamp-2">
                    <Link href={`/trips/${trip.id}`} className="hover:text-[#125238]">
                      {trip.title}
                    </Link>
                  </h2>
                  <p className="mt-3 text-xs text-[#6B7280] tabular-nums">
                    📅 Khởi hành: {formatBookingDateTime(trip.startAt)}
                  </p>
                  {isNotOpenYet && trip.registrationOpenAt && (
                    <p className="mt-1 text-xs text-amber-700 font-medium tabular-nums">
                      🔓 Mở form: {formatBookingDateTime(trip.registrationOpenAt)}
                    </p>
                  )}
                  {trip.registrationDeadlineAt && (
                    <p className="mt-1 text-xs text-amber-700 font-medium tabular-nums">
                      ⏳ Đóng form: {formatBookingDateTime(trip.registrationDeadlineAt)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[#6B7280]">
                    👤 Leader: {trip.leader?.fullName ?? 'Đang cập nhật'}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#6B7280] block uppercase font-semibold tracking-wider">
                      Giá vé trọn gói
                    </span>
                    <strong className="text-base text-[#125238] font-bold tabular-nums">
                      {trip.pricePerPax ? formatMoneyVND(trip.pricePerPax) : 'Chưa có giá'}
                    </strong>
                  </div>
                  <Link
                    href={`/trips/${trip.id}`}
                    className="rounded-xl bg-[#2F6B4F] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1F4A36]"
                  >
                    Xem chi tiết
                  </Link>
                </div>
              </SurfaceCard>
            );
          })}
        </div>

        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          itemLabel="chuyến"
        />
      </div>
    </PageShell>
  );
}

function SimpleParticipantForm({
  initial,
  max,
  busy,
  submitLabel,
  onSubmit,
}: {
  initial: { fullName: string }[];
  max: number;
  busy: boolean;
  submitLabel: string;
  onSubmit: (people: Participant[]) => Promise<void>;
}) {
  const [participants, setParticipants] = useState<Participant[]>(initial);

  const add = () => {
    if (participants.length < max) {
      setParticipants([...participants, { fullName: '', phone: '' }]);
    }
  };

  const remove = (idx: number) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== idx));
    }
  };

  const update = (idx: number, field: keyof Participant, val: string) => {
    const updated = [...participants];
    updated[idx] = { ...updated[idx], [field]: val };
    setParticipants(updated);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(participants);
      }}
      className="space-y-4"
    >
      <div className="space-y-3">
        {participants.map((p, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[#E5E7EB] bg-[#F7F7F4]/60 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1F2937]">
                Thành viên #{idx + 1}
              </span>
              {participants.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-xs font-bold text-red-600 hover:underline"
                >
                  Xóa
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                required
                type="text"
                placeholder="Họ và tên *"
                value={p.fullName}
                onChange={(e) => update(idx, 'fullName', e.target.value)}
              />
              <Input
                type="tel"
                placeholder="Số điện thoại"
                value={p.phone || ''}
                onChange={(e) => update(idx, 'phone', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
      {participants.length < max && (
        <button
          type="button"
          onClick={add}
          className="text-xs font-semibold text-[#125238] hover:underline"
        >
          + Thêm người đi cùng (Còn {max - participants.length} chỗ)
        </button>
      )}
      <Button type="submit" fullWidth loading={busy} disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function PublicBookingTrip({
  tripId,
  participantCount = 1,
}: {
  tripId: string;
  participantCount?: number;
}) {
  const { accessToken, user } = useAuth();
  const router = useRouter();
  const {
    trip,
    isLoading,
    error: fetchError,
    refetch,
  } = usePublicBookingTripDetail(tripId);
  const { createBooking, isSubmitting, error: mutationError } = useBookingMutations();

  const handleCreate = async (people: Participant[]) => {
    try {
      const result = await createBooking(tripId, people);
      router.push(`/bookings/${result.id}`);
    } catch {
      // Error handled by hook
    }
  };

  const error = mutationError?.message || fetchError;

  const nowMs = Date.now();
  const openAtMs = trip?.registrationOpenAt
    ? new Date(trip.registrationOpenAt).getTime()
    : trip?.publishedAt
    ? new Date(trip.publishedAt).getTime()
    : null;
  const deadlineMs = trip?.registrationDeadlineAt
    ? new Date(trip.registrationDeadlineAt).getTime()
    : null;
  const isNotOpenYet = openAtMs !== null && Number.isFinite(openAtMs) && nowMs < openAtMs;
  const isPastDeadline =
    deadlineMs !== null && Number.isFinite(deadlineMs) && nowMs >= deadlineMs;
  const canCreateNewBooking =
    trip?.status === 'OPEN' &&
    !isNotOpenYet &&
    !isPastDeadline &&
    (trip?.remainingSlots ?? 0) > 0;

  return (
    <PageShell maxWidth="5xl">
      <div className="space-y-6">
        <Link
          href="/trips"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#125238] hover:underline"
        >
          ← Quay lại danh sách chuyến đi
        </Link>

        {error && <ErrorAlert message={error} onRetry={refetch} />}

        {isLoading && !error && (
          <LoadingState label="Đang tải thông tin chuyến đi…" />
        )}

        {trip && (
          <>
            <TripSummaryBanner
              title={trip.title}
              status={trip.status === 'OPEN' && isNotOpenYet ? 'NOT_OPEN_YET' : trip.status}
              destinationName={trip.destination?.name}
              startAt={formatBookingDateTime(trip.startAt)}
              endAt={formatBookingDateTime(trip.endAt)}
              pickupName={
                trip.pickup
                  ? `${trip.pickup.name} (${trip.pickup.address})`
                  : 'Đang cập nhật'
              }
              capacityLabel={`Còn ${trip.remainingSlots}/${trip.capacity} chỗ`}
              priceLabel={
                trip.pricePerPax
                  ? `${formatMoneyVND(trip.pricePerPax)} / người`
                  : 'Chưa có giá'
              }
              leaderName={trip.leader?.fullName ?? 'Đang cập nhật'}
            />

            <div className="grid items-start gap-6 lg:grid-cols-2">
              <SurfaceCard className="space-y-4">
                <SurfaceSectionHeader
                  title="Thông tin hành trình"
                  subtitle={trip.description || undefined}
                />
                <div className="space-y-2 text-sm text-[#1F2937] tabular-nums">
                  <p>
                    📅 Khởi hành: {formatBookingDateTime(trip.startAt)} –{' '}
                    {formatBookingDateTime(trip.endAt)}
                  </p>
                  {trip.registrationDeadlineAt && (
                    <p className="text-amber-800 font-medium">
                      ⏳ Hạn chót đăng ký:{' '}
                      {formatBookingDateTime(trip.registrationDeadlineAt)}
                    </p>
                  )}
                  <p>👤 Leader: {trip.leader?.fullName ?? 'Đang cập nhật'}</p>
                  <p>
                    📍 Điểm tập kết:{' '}
                    {trip.pickup
                      ? `${trip.pickup.name} (${trip.pickup.address})`
                      : 'Đang cập nhật'}
                  </p>
                </div>

                {trip.routes && trip.routes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase text-[#6B7280]">
                      Tuyến đường
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-[#1F2937]">
                      {trip.routes.map(
                        (r: NonNullable<PublicTrip['routes']>[number]) => (
                          <li key={r.id} className="flex items-center gap-1.5">
                            • {r.snapshotName} ({r.snapshotDifficulty || 'Cấp 2'}
                            {r.snapshotDistanceKm && ` - ${r.snapshotDistanceKm} km`})
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {trip.checkpoints && trip.checkpoints.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase text-[#6B7280]">
                      Trạm kiểm soát
                    </h3>
                    <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-[#1F2937]">
                      {trip.checkpoints.map(
                        (c: NonNullable<PublicTrip['checkpoints']>[number]) => (
                          <li key={c.id}>
                            {c.name}
                            {c.isRequired ? ' (bắt buộc)' : ''}
                          </li>
                        )
                      )}
                    </ol>
                  </div>
                )}
              </SurfaceCard>

              <SurfaceCard className="space-y-5">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                  <strong className="text-2xl font-bold text-[#125238] tabular-nums">
                    {trip.pricePerPax
                      ? formatMoneyVND(trip.pricePerPax)
                      : 'Chưa có giá'}{' '}
                    / người
                  </strong>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-[#125238] border border-emerald-100 tabular-nums">
                    Còn {trip.remainingSlots}/{trip.capacity} chỗ
                  </span>
                </div>

                {accessToken ? (
                  canCreateNewBooking ? (
                    <SimpleParticipantForm
                      key={`participants-${participantCount}`}
                      initial={Array.from(
                        {
                          length: Math.max(
                            1,
                            Math.min(trip.remainingSlots, participantCount)
                          ),
                        },
                        (_, i) => ({
                          fullName: i === 0 ? (user?.fullName ?? '') : '',
                          phone: '',
                        })
                      )}
                      max={trip.remainingSlots}
                      busy={isSubmitting}
                      submitLabel="Giữ chỗ và tiếp tục thanh toán"
                      onSubmit={handleCreate}
                    />
                  ) : (
                    <InfoBanner
                      variant="warning"
                      title={
                        isNotOpenYet
                          ? 'Chuyến đi chưa đến giờ mở form đăng ký.'
                          : trip.status === 'CLOSED' || isPastDeadline
                          ? 'Chuyến đi đã đóng sổ đăng ký tạo đơn mới.'
                          : trip.status === 'FULL' || trip.remainingSlots <= 0
                          ? 'Chuyến đi đã đủ số lượng thành viên tối đa.'
                          : 'Chuyến đi hiện không còn nhận đặt chỗ mới.'
                      }
                    >
                      Lưu ý: Nếu bạn đã tạo đơn giữ chỗ trước thời điểm đóng form, bạn
                      vẫn có thể hoàn tất thanh toán trong thời hạn giữ chỗ tại mục{' '}
                      <Link href="/bookings" className="font-bold underline">
                        Đặt chỗ của tôi
                      </Link>
                      .
                    </InfoBanner>
                  )
                ) : (
                  <BookingSignIn />
                )}

                <p className="text-xs text-[#6B7280] leading-relaxed">
                  * Số chỗ được kiểm tra và giữ quyền ưu tiên ngay khi bạn gửi yêu cầu đặt
                  chỗ.
                </p>
              </SurfaceCard>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
